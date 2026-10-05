# SailPoint UI Plugins — Role Refresher & "Apply Changes" Simulator

An Identity Security Cloud (ISC) UI Plugin that simulates role membership changes and evaluates assignment criteria against connected accounts and identities before changes are applied.

## Problem Statement

When an administrator updates assignment criteria on a Role in SailPoint Identity Security Cloud (ISC), clicking the native **"Apply Changes"** button recalculates access across the entire tenant without any dry-run or preview. A single typo or misconfigured condition can inadvertently grant unauthorized access or cause mass deprovisioning across production accounts.

## Solution

The **Role Refresher & Apply Changes Simulator** plugin gives administrators complete visibility and granular control:
1. **Interactive Role Selector**: Browse and inspect any tenant role, its owners, and access profiles.
2. **Criteria Visualizer**: Parses complex `AND`/`OR` criteria trees and provides clear, human-readable explanations.
3. **Delta Calculation Engine**: Evaluates criteria against tenant accounts (`accounts/v1`) and sources (`sources/v1`) to compute:
   - **+ Will Gain Role**: Users who meet criteria but do not currently have the role.
   - **- Will Lose Role**: Current role members who no longer satisfy criteria (**deprovisioning risk alert**).
   - **= Retained**: Current members whose access is preserved.
4. **Targeted Identity Processing**: Instead of a global tenant refresh, select specific impacted users and dispatch targeted recalculations via `POST /identities/v1/process`.

## Architecture & Technology Stack

- **Framework**: Angular 21 (Standalone Components & Signals)
- **Component Library**: PrimeNG 21 styled with the SailPoint Design System theme (`--spds-*`)
- **SDK**: `@sailpoint/ui-plugin-sdk` & `@sailpoint/angular-sdk`
- **Isolation**: Runs inside ISC's sandboxed iframe using the COIP postMessage protocol with scoped bearer tokens.

## Development & Usage

### Prerequisites
- Node.js 24+ & npm 11+
- SailPoint CLI 2.7.0+ (`sail`)

### Setup & Local Dev
```bash
cd role-refresher-tyler
npm install
npm start
```
Link local port 4200 to your ISC identity:
```bash
sail ui-plugins link
```
Open the returned developer URL with `?spPluginDev=role-refresher-tyler` in your tenant.

### Build & Deploy
```bash
npm run build
sail ui-plugins upload
```
The deployed plugin can then be accessed directly or added to the ISC navigation bar via **Admin → Global → System Settings → Customize Navbar**.

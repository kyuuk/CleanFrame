# Native Home control

This one-shot development helper is scoped to Nathan's Frame and firmware 2130.0, plus a contributor's Tizen 8 TV (ED50T01UHD-RE, firmware T-24RSSFUCVTDEUC-1241.0). On that TV, `record`, `restore` and `apply` ran on 26 October 2026 and the owner confirmed that CleanFrame works as native Home. It does not run inside CleanFrame or remain active on the TV. It uses the existing SDB developer connection and the published package-name command workaround to execute as SDK UID 901. It does not request root or change security policy.

`Control.cs` exposes read-only query, guarded apply, and exact-value restore through native Home and vconf APIs. It refuses other firmware, root, changed original values, or an ineligible/missing app. Apply failures attempt immediate restore. The baseline and compiled tools remain in ignored `.local/native-home/`.

From the project root:

```sh
python3 scripts/native-home/run.py query
python3 scripts/native-home/run.py record
python3 scripts/native-home/run.py restore
```

The existing private `original.json` is the tested rollback baseline. Do not overwrite it with the applied state. On a new installation, `record` runs the query once before any apply and saves the snapshot as a read-only `original.json`. It refuses to stage anything if the file exists, and records nothing if the snapshot is incomplete or already names the launcher from `app/config.xml`. The runner re-stages the helper and baseline each time. The runner uses `sdb` from `.local/tizen-sdk`, or from the SDK named by `CLEANFRAME_TIZEN_SDK` (for example `C:\tizen-studio`). The query/apply/restore/inspect shell source is retained beside the runner. `diagnose` is a read-only boot-eligibility probe: it lists the launcher's install folders and installed manifests, and searches Samsung's app-context library for the rules it checks. On the Tizen 8 firmware that function returned 0 for every app, so apply there instead requires the installed package manifest to declare `appbootingsupport`, as YouTube, Netflix and Browser do. The helper cannot read that manifest on this firmware, so `apply.sh` checks it and passes `boot-metadata`; the reference firmware keeps the function's result. `eligible` asks the same boot-eligibility function about CleanFrame and installed apps that declare `appbootingsupport`, and prints matching app-context log lines. Except for the shell-only `inspect` and `diagnose`, it needs the compiled output in `.local/native-home/out/`; build with the private verified Microsoft SDK when the C# source changes. No local address, device identifier, compiled binary or signing secret belongs in this source folder.

Even query/inspect stages temporary helper files on the device. These are device operations, not offline repository checks. A clone without the private baseline, SDK and compiled output cannot perform the tested rollback. Preserve the local recovery folder separately; GitHub is a source backup only.

The implementation was reviewed against the [published S90D native Home work](https://github.com/splitcipher/couchroot/blob/83906b468836869933012da03a4018fb339462b3/docs/devices/s90d/README.md). This Frame's native query, apply/restore/reapply and physical Home-from-Netflix test were checked independently. On the Tizen 8 TV, a recorded baseline, restore to its exact values and apply via the `boot-metadata` path were checked; the owner confirmed that the physical Home button opens CleanFrame and that the TV boots into it. Source review does not replace device testing after future firmware changes.

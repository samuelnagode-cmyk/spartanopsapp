# Architecture rules

- Keep field-password throttle constants and time calculations in the import-free `field-attempts` module so both server code and unit tests use the same policy without circular imports.
- Use one preview-guarded PWA registrar and generated worker; never cache server calls, scan results, OAuth or live game data, because cached answers cannot authorize gameplay.
- Store recovery metadata in the existing active-session record and reuse the existing check-in lookup; local team and game values are convenience metadata, never authority.
- Keep audio-control route visibility in an import-free helper, separate from playback routing, so visibility tests cannot alter sound behavior.
- Keep mission audio-phase signals in an import-free helper so marshal and participant phase rules can be tested without importing the mission screen.
- Keep respawn rescan timing in the import-free `respawn-scan` helper so the route and tests share the guard without importing a screen.
- Keep debrief tie ordering in an import-free comparator so ranking tests cannot import the mission screen or expose private deaths through ordering.
- Keep public share sector/spawn geometry and team-rank selection in import-free helpers; export only callsigns and preload map pixels as data URLs to isolate map failures from the debrief.
# Architecture rules

- Keep field-password throttle constants and time calculations in the import-free `field-attempts` module so both server code and unit tests use the same policy without circular imports.
- Use one preview-guarded PWA registrar and generated worker; never cache server calls, scan results, OAuth or live game data, because cached answers cannot authorize gameplay.
- Store recovery metadata in the existing active-session record and reuse the existing check-in lookup; local team and game values are convenience metadata, never authority.
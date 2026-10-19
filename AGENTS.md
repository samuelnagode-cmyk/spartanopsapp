# Architecture rules

- Keep field-password throttle constants and time calculations in the import-free `field-attempts` module so both server code and unit tests use the same policy without circular imports.
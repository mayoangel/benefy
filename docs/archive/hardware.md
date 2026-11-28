# Hardware e IoT

Nota histórica sobre la carpeta reservada para estaciones y dispositivos Benefy
basados en ESP32-S3. No hay firmware, esquemas electrónicos, dependencias,
pruebas ni comandos de compilación o carga.

El [SRS](./Benefy%20SRS.pdf) propone registro QR/NFC e interacción con asistentes
mediante dispositivos físicos. Esas interfaces no están implementadas en
hardware ni en Benef AI.

Antes de incorporar firmware se deben definir el protocolo con Django, la
identidad de cada dispositivo, los permisos de negocio/sucursal y los mecanismos
de validación de operaciones. No se deben distribuir credenciales PostgreSQL,
contraseñas de usuarios ni claves secretas de Supabase en los dispositivos.

El backend actual y sus limitaciones están descritos en [API](../api.md) y en el
[README raíz](../../README.md).

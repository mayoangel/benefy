# Benefy

Especificacion de requisitos de software - Rev 1.0

## Descripcion del Proyecto

Benefy es una solucion SaaS (Software as a Service) B2B enfocada en el sector de servicios. Su objetivo es proporcionar una plataforma centralizada donde los negocios pueden diseñar y gestionar sus dinamicas de lealtad (puntos, sellos y cupones de descuento), orientada al autoservicio del cliente final. 

El sistema fomenta colaboraciones B2B (Cross-Marketing) permitiendo que dos negocios se enlacen para ofrecer recompensas compartidas.

## Arquitectura del Sistema

El proyecto esta compuesto por cuatro pilares principales:

1. Backend (Django REST Framework): API centralizada que maneja la logica de negocio, el flujo de transacciones, la base de datos relacional y la integracion con servicios de terceros.
2. Dashboard Web (React): Panel administrativo de inteligencia de negocio para los dueños de comercios afiliados.
3. Aplicacion Movil (React Native): Plataforma orientada al consumidor final para el escaneo de codigos QR/NFC y gestion de recompensas.
4. Infraestructura IoT: Integracion con microcontroladores ESP32-S3 como estaciones inteligentes de registro y asistentes IA (ESP-CLAW).

## Tecnologias Principales

* Backend: Python, Django, Django REST Framework.
* Base de Datos: PostgreSQL (Supabase).
* Frontend Administrativo: React, Tailwind CSS.
* Frontend Movil: React Native.
* Hardware IoT: Microcontroladores ESP32-S3.
* Integraciones Externas:
  - Autenticacion: Firebase Auth (Google OAuth 2.0 / JWT).
  - Notificaciones: Firebase Cloud Messaging (FCM).
  - Pasarela de Pagos: Stripe (Suscripciones B2B).
  - Almacenamiento Multimedia: Cloudinary.
  - Monitoreo de Errores: Sentry.

## Estructura del Repositorio

* /backend: Contiene el proyecto Django dockerizado, gestion de API, modelos de Supabase y webhooks de Stripe.
* /frontend-web: Contiene el proyecto React para el dashboard de administradores de comercios.
* /mobile-app: Contiene el proyecto React Native para la aplicacion del cliente final.
* /iot-firmware: Contiene el codigo fuente para los dispositivos ESP32-S3.

## Requisitos Previos

* Docker y Docker Compose (para despliegue local del backend).
* Node.js (v18+) y gestor de paquetes (npm o yarn).
* Entorno de desarrollo para React Native (Android Studio para la fase 1).
* Variables de entorno configuradas para Stripe, Firebase, Supabase y Cloudinary.
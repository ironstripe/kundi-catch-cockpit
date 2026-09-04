# Kundi Catch Cockpit

Build the foundation for a new internal web application called Kundi Catch Cockpit.

Product context

Kundi Catch is a Kundelfingerhof initiative for selling limited seafood surplus and special lots through WhatsApp.

The application will later support:

catch planning and pricing

product image management

WhatsApp post preparation

manual publication through WhatsApp Desktop

manual sell-through reconciliation

catch history and learning

Do not implement all these features yet. This prompt covers only the application foundation.

Mandatory design reference

Use the same visual style, component language and interaction patterns as the existing Kundivent application.

Kundi Catch must feel like a sister application to Kundivent, not like a separate new product.

Reuse or closely match the Kundivent approach for:

application shell

sidebar or main navigation

page width and content grid

typography

spacing system

form controls

cards

tables

filters

status badges

dialogs

notifications

loading states

empty states

error states

responsive behaviour

Do not introduce a generic SaaS dashboard style.

Use the supplied Kundi Catch logo as the product logo. Do not redraw, reinterpret or replace it.

The approved brand texts are:

Guter Fisch. Kleines Handicap. Grosser Fang.

Schnell sein. Gut essen. Food Waste vermeiden.

Do not create additional taglines.

The Kundivent colour system remains the UI foundation. Colours from the Kundi Catch logo may be used as restrained product accents.

Step 1 scope

Create the application shell with these navigation items:

Dashboard

New Catch

History

Settings

Use English route and component names internally, but display the user interface in German.

Recommended German labels:

Dashboard

Neuer Catch

Historie

Einstellungen

The application must be desktop-first because it will be used alongside WhatsApp Desktop. It must remain fully usable on tablets.

Dashboard foundation

Create a clean dashboard page with:

page title: Kundi Catch Cockpit

primary action: Neuer Catch

section: Laufende Catches

section: Letzte abgeschlossene Catches

four compact KPI placeholders:

Aktive Catches

Geplante Einkaufsmenge

Erwarteter Deckungsbeitrag

Durchschnittlicher Abverkauf

Use clearly marked placeholder data for now.

Create three realistic sample catch cards or rows:

Felchenfilets TK

Frischer Lachs

Rauchforelle

Each sample should display:

product image placeholder

catch number

product name

Frisch or TK

location

availability date

status badge

purchase quantity

catch price

expected sell-through percentage

Use the statuses:

Entwurf

Bereit

Publiziert

Abgeschlossen

Abgebrochen

Empty pages

Create structurally complete placeholder pages for:

Neuer Catch

Show an empty form shell with future sections:

Produkt

Bild

Beschaffung

Preis und Menge

Aktion

Handicap-Story

WhatsApp-Post

Do not implement calculation logic yet.

Historie

Show:

page title

search field

filter placeholders

empty or sample history table

Future filters:

Zeitraum

Frisch / TK

Produkt

Lieferant

Standort

Status

Einstellungen

Create placeholder sections for:

Standorte

Lieferanten

Kategorien

Nutzer und Rollen

WhatsApp-Textvorlage

Markenasset

Data foundation

Use Supabase.

Create the initial database structure for:

catches

Include:

id

catch_number

status

product_name

category

description

packaging

expiry_date

supplier_id

purchase_quantity

quantity_unit

purchase_price

delivery_cost

normal_price

catch_price

available_from

available_until

handicap_reason

internal_note

published_at

published_by

closed_at

closed_by

remaining_quantity

other_outflow_quantity

other_outflow_reason

learning

created_at

created_by

updated_at

updated_by

catch_images

Include:

id

catch_id

original_path

optimized_path

mime_type

width

height

is_primary

created_at

suppliers

Include:

id

name

contact_note

active

created_at

updated_at

locations

Include:

id

name

address

pickup_note

active

created_at

updated_at

catch_locations

Include:

catch_id

location_id

post_versions

Include:

id

catch_id

generated_text

final_text

created_at

created_by

audit_events

Include:

id

catch_id

actor_id

event_type

changed_fields

created_at

Use UUID primary keys, appropriate foreign keys, indexes and timestamps.

Use database constraints for valid status values and non-negative quantities and prices.

Do not implement public access.

Technical requirements

Use the same technology and structural conventions as Kundivent where practical.

Keep components modular and reusable.

Use Europe/Zurich as the application timezone.

Use CHF as the currency.

Use Swiss date and number formatting.

Prepare the application as a PWA, following the same approach as Kundivent.

Do not add a WhatsApp API.

Do not add payment processing.

Do not add order management.

Do not add a POS integration.

Do not add AI text generation.

Do not implement image clipboard functionality yet.

Acceptance criteria

This step is complete when:

The Kundi Catch application shell is working.

Navigation between all four main sections works.

The UI clearly follows the Kundivent design language.

The supplied Kundi Catch logo is correctly integrated.

The dashboard displays realistic sample content.

The empty functional pages are ready for later implementation.

The Supabase schema has been created with the required relationships and constraints.

The application works on desktop and tablet.

No functionality from later implementation steps has been prematurely added.

Before finishing, verify the database migrations, responsive layout, navigation and all empty states.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/de9d48a2-e970-4e58-9835-8b46b712a86a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

# Smart prompt → promotion (spec for the four concept mockups, then the build)

Owner ask (2026-09-10): "a smart prompt field that can build entirely new promotion concepts by
pulling different data parameters from our system to make them work — this eliminates the need
of our dev team to create new promotions that aren't programmed into the system."

## What the prompt box does (same behaviour in every concept; each renders it its own way)

1. **Input**: one text field with placeholder examples, e.g.
   "Customers who usually buy Raw Garden but haven't ordered in 45 days get 20% off Raw Garden
   concentrates, delivery only, this Friday to Sunday, once each."
2. **Interpretation**: the system reads the prompt and shows, before anything is saved, a
   structured interpretation the marketer can edit:
   - **Who** (audience conditions) — e.g. `brand affinity = Raw Garden` · `days since last order ≥ 45`
   - **What** (product scope) — `brand = Raw Garden` AND `category = Concentrates`, optional
     exclusion list
   - **Reward** (action) — `20% off matching items`
   - **Where / how** (scope) — stores `all`, channel `delivery only`
   - **When** — `Fri 13 Sep – Sun 15 Sep`, `once per customer`
   - **Guardrails** — stacking `no`, budget cap `none set`
   Each line is the concept's native control (A: sentence tokens; B: recipe slots; C: tray
   chips; D: nodes) — editing there is the same as editing a hand-built rule.
3. **Live numbers** (demo data, labelled): customers matched, products matched, estimated
   redemptions, estimated cost, each with "why this number" on hover.
4. **Parameters it pulled from the system**: a small list naming every data parameter used,
   with its source (customer trait catalog · product attributes · saved audiences · saved lists ·
   stores · calendar). This is the "pulls data parameters from our system" the owner asked for.
5. **When a parameter does not exist yet**: the box does not fail. It shows
   "Needs a new parameter: **orders placed after 8 pm** — I can derive it from
   `orders.created_at` (hour ≥ 20). Create it?" One click creates the parameter in the trait
   catalog (data, not code) and re-runs the interpretation. Example prompt to show:
   "10% off for anyone who orders after 8 pm on weekdays at Corona" → new parameter
   "order hour" from order timestamps, plus store scope Corona, plus weekday time rule.
   If the data truly does not exist anywhere (e.g. "customers who own a dog"), it says so
   honestly: "No data source for this — ask a developer to add a field, or collect it with a
   questionnaire" and offers the questionnaire block.
6. **Explain and refine**: a plain-language readout of the final rule, a "Refine" field to
   change it in words ("make it in-store too", "exclude the Clearance list"), and a version list
   (prompt → rule pairs) so nothing is a black box.
7. **Save** produces the same promotion object as the hand-built path (rule JSON validated
   against the trait catalog — never raw SQL, never free code), status `draft`, with the prompt
   and interpretation stored on it for audit.

## Dev call-out to include

"The prompt box compiles to the same rule JSON as the builders; the model only proposes, the
catalog validates, the engine evaluates. Production must add: audience, product_list, store,
channel attributes to the promotion engine; a derived-parameter definition table (name,
source field, expression, type) read by the trait catalog; a prompt + interpretation audit on
the promotion."

## Same prompt, for journeys (owner ask, 2026-09-10: "use the prompt field to build the flows")

The Journeys tab carries the same prompt entry, in the concept's flavour. Example prompt:
"When a customer's ordering slows down, wait a week, then text them a $10 delivery-only reward;
if they still haven't ordered 14 days later, email them 2x points on their next order; stop when
they order." The interpretation is a graph: **Trigger** (order-frequency drop, a catalog
parameter) → **Wait 7 days** → **Branch: ordered since?** (yes → Exit) → **Message: SMS short
body + landing page with reward "Welcome back $10", delivery only** → **Wait 14 days** →
**Branch: ordered since?** → **Message: email, 2x points on next order** → **Exit**. Every node is
the concept's normal node, editable; the policy chain (consent, quiet hours, frequency caps)
shows its verdict on each message node; estimated enrolment per node (demo, labelled) and the
"parameters pulled from the system" list appear beside the graph; a missing parameter ("customers
who reviewed us") becomes the same "create it / no data source" card; Refine works in words
("make the second message an SMS too", "only Corona customers"); prompt + interpretation are
stored on the journey version. Saving produces the same journey object as the hand-built path.

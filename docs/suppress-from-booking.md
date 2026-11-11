# Suppress from booking

Bookings can be blocked for an instance, a holdings record or an item by setting the **Suppress from
booking** flag. A booking that includes an item flagged at any of the three levels is rejected with
"Item … is suppressed from booking"; staff with *Bookings: Override item availability* can override.

The flag is a real field on the Inventory records, so it needs changes outside this repository. They are
provided as patches in [`/patches`](../patches), made against the commits named below.

| Patch | Applies to | Base commit |
|---|---|---|
| `mod-inventory-storage-suppress-from-booking.patch` | mod-inventory-storage | `c0a0263` |
| `mod-inventory-suppress-from-booking.patch` | mod-inventory | `89eed92` |
| `ui-inventory-suppress-from-booking.patch` | ui-inventory | `d57de11` |

Apply each in the matching repository with `git apply <path>/patches/<name>.patch` (or `git am` after
converting to a commit). Newer upstream commits may need small manual merges.

## What each patch does

**mod-inventory-storage** – adds the boolean `suppressFromBooking` to the instance, holdings record,
item and dereferenced-item schemas (instance defaults to `false`). Maintainers also need to bump the
minor versions of the `instance-storage` (11.5 → 11.6), `holdings-storage` (8.2 → 8.3) and `item-storage`
(11.2 → 11.3) interfaces in the module descriptor and add a NEWS.md entry; this is not done in the patch
so the numbers can follow whatever is current upstream.

**mod-inventory** – mod-inventory rebuilds items and instances field by field, so without this patch a
normal save would silently drop the flag. The patch carries the flag through `Item`, `ItemUtil`,
`ItemRepresentation` and `Instance`. Holdings need no change here: they use the storage DTO library, which
picks the field up when it is rebuilt against the new schema. *Known gap:* instances and holdings updated by
Data Import overlays are rebuilt from the generic mapping and do not carry the flag over.

**ui-inventory** – adds a **Suppress from booking** checkbox to the instance, holdings and item edit forms
and a "Suppressed from booking" notice to the three views. Both are shown only to users with the new
permission **Inventory: Suppress from booking** (`ui-inventory.suppress-from-booking.manage`). Institutions
that do not use Bookings simply never assign it, and the field is invisible to them.

## Bookings side

`mod-bookings-bl` reads the flag from the item (through mod-inventory), and from the holdings record
(`holdings-storage`) and instance (`instance-storage`). A record that cannot be read, or that does not
know the flag, counts as *not suppressed*, so Bookings works unchanged on a platform without the patches.

Some JSON data examples from the Argyle API. We used these examples to create SQL schemas.

## Activities

```sql
CREATE TABLE IF NOT EXISTS activites_example (
    "id" TEXT,
    "account" TEXT,
    "employer" TEXT,
    "link_item" TEXT,
    "data_partner" TEXT,
    "created_at" TEXT,
    "updated_at" TEXT,
    "status" TEXT,
    "type" TEXT,
    "num_tasks" INT,
    "start_date" TEXT,
    "end_date" TEXT,
    "duration" INT,
    "timezone" TEXT,
    "earning_type" TEXT,
    "start_location_lat" NUMERIC(17, 15),
    "start_location_lng" NUMERIC(16, 14),
    "end_location_lat" NUMERIC(17, 15),
    "end_location_lng" NUMERIC(16, 14),
    "start_location_formatted_address" TEXT,
    "end_location_lat" NUMERIC(16, 14),
    "end_location_lng" NUMERIC(16, 14),
    "end_location_formatted_address" TEXT,
    "route" TEXT,
    "distance" NUMERIC(4, 2),
    "distance_unit" TEXT,
    "complete_data_available" TEXT,
    "metadata" TEXT,
    "circumstances_is_pool" TEXT,
    "circumstances_is_rush" TEXT,
    "circumstances_is_surge" TEXT,
    "circumstances_service_type" TEXT,
    "circumstances_position" INT,
    "income_currency" TEXT,
    "income_total_charge" NUMERIC(4, 2),
    "income_fees" NUMERIC(3, 2),
    "income_total" NUMERIC(4, 2),
    "income_pay" NUMERIC(4, 2),
    "income_tips" NUMERIC(3, 2),
    "income_bonus" NUMERIC(3, 2),
    "income_taxes" INT,
    "income_rates_hour" NUMERIC(4, 2),
    "income_rates_mile" NUMERIC(3, 2),
    "start_location" INT,
    "end_location" INT
);
```

## Reputations

```sql


```

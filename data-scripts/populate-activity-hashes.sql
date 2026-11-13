-- SQL script to populate ride_hash column for argyle_driver_activities
-- This script emulates the functionality of backfillRideHashes.ts
-- Processes in batches using a temporary table approach

-- Enable hash functions extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create a temporary table to track our progress
CREATE TEMP TABLE IF NOT EXISTS batch_progress (
    batch_num INTEGER,
    rows_processed INTEGER,
    start_time TIMESTAMP,
    end_time TIMESTAMP
);

-- Get initial count and show progress
DO $$
DECLARE
    total_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count 
    FROM argyle_driver_activities 
    WHERE ride_hash IS NULL;
    
    RAISE NOTICE '🚀 Starting ride hash backfill process...';
    RAISE NOTICE '📊 Found % activities without hashes to process', total_count;
    RAISE NOTICE '📦 Processing in batches of 50000 rows';
    RAISE NOTICE '';
END $$;

-- Process all batches in a loop
DO $$
DECLARE
    batch_size INTEGER := 50000;
    batch_num INTEGER := 1;
    rows_updated INTEGER;
    remaining_count INTEGER;
    start_time TIMESTAMP;
    total_initial INTEGER;
BEGIN
    -- Get initial count
    SELECT COUNT(*) INTO total_initial 
    FROM argyle_driver_activities 
    WHERE ride_hash IS NULL;
    
    -- Loop until no more rows to process
    LOOP
        start_time := NOW();
        
        -- Process current batch
        WITH current_batch AS (
            SELECT id, "user", start_datetime, end_datetime, 
                   start_location_lat, start_location_lng,
                   end_location_lat, end_location_lng, income_total,
                   ROW_NUMBER() OVER (ORDER BY id) as rn
            FROM argyle_driver_activities 
            WHERE ride_hash IS NULL
        ),
        limited_batch AS (
            SELECT * FROM current_batch WHERE rn <= batch_size
        )
        UPDATE argyle_driver_activities 
        SET ride_hash = generate_ride_hash(
            lb."user",
            lb.start_datetime,
            lb.end_datetime,
            lb.start_location_lat,
            lb.start_location_lng,
            lb.end_location_lat,
            lb.end_location_lng,
            lb.income_total
        )
        FROM limited_batch lb
        WHERE argyle_driver_activities.id = lb.id;
        
        GET DIAGNOSTICS rows_updated = ROW_COUNT;
        
        -- Check remaining count
        SELECT COUNT(*) INTO remaining_count 
        FROM argyle_driver_activities 
        WHERE ride_hash IS NULL;
        
        -- Log progress
        INSERT INTO batch_progress VALUES (batch_num, rows_updated, start_time, NOW());
        
        RAISE NOTICE '✅ Batch % complete: % rows updated, % remaining', batch_num, rows_updated, remaining_count;
        
        -- Exit if no more rows were updated or no rows remaining
        EXIT WHEN rows_updated = 0 OR remaining_count = 0;
        
        batch_num := batch_num + 1;
        
        -- Safety check to prevent infinite loops
        IF batch_num > 1000 THEN
            RAISE NOTICE '⚠️  Safety limit reached (1000 batches). Stopping to prevent infinite loop.';
            EXIT;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 Batch processing completed! Processed % batches total.', batch_num - 1;
END $$;

-- Show final summary
DO $$
DECLARE
    total_processed INTEGER;
    total_remaining INTEGER;
    rec RECORD;
BEGIN
    SELECT SUM(rows_processed) INTO total_processed FROM batch_progress;
    
    SELECT COUNT(*) INTO total_remaining 
    FROM argyle_driver_activities 
    WHERE ride_hash IS NULL;
    
    RAISE NOTICE '';
    RAISE NOTICE '📈 PROCESSING SUMMARY:';
    RAISE NOTICE '✅ Total processed: %', COALESCE(total_processed, 0);
    RAISE NOTICE '⏳ Remaining: %', total_remaining;
    
    -- Show batch details
    FOR rec IN (
        SELECT batch_num, rows_processed 
        FROM batch_progress 
        ORDER BY batch_num
    ) LOOP
        RAISE NOTICE '   Batch %: % rows', rec.batch_num, rec.rows_processed;
    END LOOP;
END $$;

-- Analyze potential duplicates
DO $$
DECLARE
    duplicate_count INTEGER;
    total_duplicates INTEGER;
    rec RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔍 DUPLICATE ANALYSIS:';
    
    -- Count hash groups with more than one activity
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT ride_hash, COUNT(*) as cnt
        FROM argyle_driver_activities 
        WHERE ride_hash IS NOT NULL
        GROUP BY ride_hash
        HAVING COUNT(*) > 1
    ) duplicates;
    
    -- Count total duplicate activities
    SELECT SUM(cnt - 1) INTO total_duplicates
    FROM (
        SELECT ride_hash, COUNT(*) as cnt
        FROM argyle_driver_activities 
        WHERE ride_hash IS NOT NULL
        GROUP BY ride_hash
        HAVING COUNT(*) > 1
    ) duplicates;
    
    RAISE NOTICE '🔍 Potential duplicates found: % hash groups', COALESCE(duplicate_count, 0);
    RAISE NOTICE '📊 Total duplicate activities: %', COALESCE(total_duplicates, 0);
    
    -- Show sample duplicate groups
    IF duplicate_count > 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE 'Sample duplicate groups (top 5):';
        
        FOR rec IN (
            SELECT 
                encode(ride_hash, 'hex') as hash_hex,
                COUNT(*) as activity_count,
                (array_agg(id ORDER BY id))[1:3] as sample_ids
            FROM argyle_driver_activities 
            WHERE ride_hash IS NOT NULL
            GROUP BY ride_hash
            HAVING COUNT(*) > 1
            ORDER BY COUNT(*) DESC
            LIMIT 5
        ) LOOP
            RAISE NOTICE '   Hash %... -> % activities: %', 
                LEFT(rec.hash_hex, 12), 
                rec.activity_count,
                array_to_string(rec.sample_ids, ', ');
        END LOOP;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 Analysis completed!';
    
END $$;

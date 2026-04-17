/**
 * Memory-Safe Utilities for Large-Scale Data Processing
 * Prevents heap memory errors with batching, streaming, and cleanup
 */

class MemorySafeProcessor {
    constructor(options) {
        options = options || {};
        this.defaultBatchSize = options.batchSize || 100;
        this.defaultDelay = options.delay || 100;
        this.maxMemoryPercent = options.maxMemoryPercent || 80;
    }

    isMemoryCritical() {
        const used = process.memoryUsage();
        const heapUsedMB = used.heapUsed / 1024 / 1024;
        const heapTotalMB = used.heapTotal / 1024 / 1024;
        const percentUsed = (heapUsedMB / heapTotalMB) * 100;
        return percentUsed > this.maxMemoryPercent;
    }

    getMemoryStats() {
        const used = process.memoryUsage();
        return {
            heapUsed: Math.round(used.heapUsed / 1024 / 1024) + ' MB',
            heapTotal: Math.round(used.heapTotal / 1024 / 1024) + ' MB',
            external: Math.round(used.external / 1024 / 1024) + ' MB',
            rss: Math.round(used.rss / 1024 / 1024) + ' MB'
        };
    }

    async cleanup() {
        if (global.gc) {
            global.gc();
        }
        return new Promise(function(resolve) {
            setTimeout(resolve, 10);
        });
    }

    async processBatches(items, processor, options) {
        options = options || {};
        var batchSize = options.batchSize || this.defaultBatchSize;
        var delay = options.delay || this.defaultDelay;
        var onProgress = options.onProgress;
        
        var results = [];
        var total = items.length;
        
        for (var i = 0; i < total; i += batchSize) {
            if (this.isMemoryCritical()) {
                await this.cleanup();
            }
            
            var batch = items.slice(i, i + batchSize);
            var batchPromises = batch.map(function(item) {
                return processor(item).catch(function(err) {
                    return { error: err.message };
                });
            });
            var batchResults = await Promise.all(batchPromises);
            
            results.push.apply(results, batchResults);
            
            if (onProgress) {
                onProgress({
                    processed: Math.min(i + batchSize, total),
                    total: total,
                    percent: Math.round(((i + batchSize) / total) * 100)
                });
            }
            
            if (i + batchSize < total) {
                await new Promise(function(resolve) {
                    setTimeout(resolve, delay);
                });
            }
        }
        
        return results;
    }

    async bulkWrite(model, operations, options) {
        options = options || {};
        var batchSize = options.batchSize || this.defaultBatchSize;
        var ordered = options.ordered !== false;
        
        var results = {
            matchedCount: 0,
            modifiedCount: 0,
            upsertedCount: 0,
            errors: []
        };
        
        for (var i = 0; i < operations.length; i += batchSize) {
            if (this.isMemoryCritical()) {
                await this.cleanup();
            }
            
            var batch = operations.slice(i, i + batchSize);
            
            try {
                var result = await model.bulkWrite(batch, { ordered: ordered });
                results.matchedCount += result.matchedCount || 0;
                results.modifiedCount += result.modifiedCount || 0;
                results.upsertedCount += result.upsertedCount || 0;
            } catch (err) {
                results.errors.push({ index: i, error: err.message });
                if (!ordered) {
                    console.error('Bulk write batch ' + i + ' error:', err.message);
                }
            }
            
            await new Promise(function(resolve) {
                setTimeout(resolve, 10);
            });
        }
        
        return results;
    }
}

function batchIterator(array, batchSize) {
    var i = 0;
    return {
        next: function() {
            if (i >= array.length) {
                return { done: true };
            }
            var batch = array.slice(i, i + batchSize);
            i += batchSize;
            return { done: false, value: batch };
        }
    };
}

function clearArray(arr) {
    if (Array.isArray(arr)) {
        arr.length = 0;
    }
}

module.exports = {
    MemorySafeProcessor: MemorySafeProcessor,
    batchIterator: batchIterator,
    clearArray: clearArray
};
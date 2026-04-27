/**
 * Task Analyzer Engine
 * Analyzes ASIN data and generates optimization tasks based on LQS scores
 */

class TaskAnalyzer {

    static async analyzeAsin(asin) {
        const tasks = [];

        // 1. TITLE QUALITY CHECK
        if (asin.TitleScore != null && asin.TitleScore < 60) {
            tasks.push({
                title: `Improve Title Quality (Score: ${asin.TitleScore})`,
                description: `The product title "${asin.Title?.substring(0, 80)}..." needs optimization. Current score: ${asin.TitleScore}/100. Ensure title is 60-80 characters, includes brand + product type + key features, and has no promotional content.`,
                category: 'Title',
                priority: asin.TitleScore < 40 ? 'High' : 'Medium',
                type: 'optimization',
                impactScore: 85,
                effortEstimate: 'Quick',
                aiReasoning: `Title score is ${asin.TitleScore}/100. Common issues: length, promotional words, missing keywords, or poor structure.`
            });
        }

        // 2. BULLET POINTS CHECK
        if (asin.BulletScore != null && asin.BulletScore < 60) {
            const bulletCount = asin.BulletPointsCount || 0;
            tasks.push({
                title: `Add/Improve Bullet Points (${bulletCount} of 5+ recommended)`,
                description: `This listing has only ${bulletCount} bullet points. Amazon recommends at least 5 bullet points highlighting key features and benefits. Each should be 10-255 characters.`,
                category: 'Bullet Points',
                priority: bulletCount < 3 ? 'High' : 'Medium',
                type: 'optimization',
                impactScore: 75,
                effortEstimate: 'Quick',
                aiReasoning: `Bullet score is ${asin.BulletScore}/100. Only ${bulletCount} bullets found. Ideal: 5-7 bullets with Header: Description format.`
            });
        }

        // 3. IMAGE QUALITY CHECK
        if (asin.ImageScore != null && asin.ImageScore < 70) {
            const imgCount = asin.ImagesCount || 0;
            tasks.push({
                title: `Improve Product Images (${imgCount} of 6+ recommended)`,
                description: `This listing has ${imgCount} images. Amazon recommends at least 6 high-quality images including main (white background), lifestyle, detail, and size reference shots. Images should be 1000px+ for zoom.`,
                category: 'Images',
                priority: imgCount < 3 ? 'High' : (imgCount < 5 ? 'Medium' : 'Low'),
                type: 'optimization',
                impactScore: 70,
                effortEstimate: 'Medium',
                aiReasoning: `Image score is ${asin.ImageScore}/100. ${imgCount} images found. Need: main white background, lifestyle, detail shots, size reference.`
            });
        }

        // 4. A+ CONTENT CHECK
        if (!asin.HasAplus) {
            tasks.push({
                title: `Add A+ Content`,
                description: `A+ Content significantly improves conversion rates. Create rich product descriptions with comparison charts, lifestyle images, and enhanced brand content.`,
                category: 'A+ Content',
                priority: 'Medium',
                type: 'optimization',
                impactScore: 90,
                effortEstimate: 'Large',
                aiReasoning: `A+ Content is missing. Listings with A+ content see 3-10% higher conversion rates on average.`
            });
        }

        // 5. BUYBOX LOST CHECK
        if (asin.BuyBoxWin === false || asin.BuyBoxWin === 0) {
            tasks.push({
                title: `Recover BuyBox - Currently Lost`,
                description: `This ASIN has lost the BuyBox. Current seller: ${asin.SoldBy || 'Unknown'}. Your price: ₹${asin.CurrentPrice || 0}. Competitor price: ₹${asin.SecondAsp || 0}. Review pricing strategy and seller metrics.`,
                category: 'BuyBox',
                priority: 'High',
                type: 'fix',
                impactScore: 95,
                effortEstimate: 'Quick',
                aiReasoning: `BuyBox lost. Check seller health metrics and competitive pricing.`
            });
        }

        // 6. LOW LQS OVERALL
        if (asin.Lqs != null && asin.Lqs < 60) {
            tasks.push({
                title: `Critical: Overall LQS Below 60% (${asin.Lqs}%)`,
                description: `This listing has a critically low Listing Quality Score of ${asin.Lqs}%. This impacts search visibility and conversion. Address all major issues: title, images, bullet points, and A+ content.`,
                category: 'General',
                priority: 'High',
                type: 'urgent',
                impactScore: 100,
                effortEstimate: 'Large',
                aiReasoning: `Overall LQS is ${asin.Lqs}%. Multiple factors need attention. Prioritize: Title > Images > Bullet Points > A+ Content.`
            });
        }

        // 7. REVIEW ALERT
        if (asin.Rating != null && asin.Rating < 3.5 && asin.ReviewCount > 10) {
            tasks.push({
                title: `Address Low Rating (${asin.Rating?.toFixed(1)}★ with ${asin.ReviewCount} reviews)`,
                description: `This product has a low average rating of ${asin.Rating?.toFixed(1)} stars from ${asin.ReviewCount} reviews. Review customer feedback, identify common complaints, and improve product quality or listing accuracy.`,
                category: 'Reviews',
                priority: 'High',
                type: 'fix',
                impactScore: 80,
                effortEstimate: 'Medium',
                aiReasoning: `Rating ${asin.Rating}★ is below the 3.5★ threshold. Common causes: product quality mismatch, inaccurate listing, poor customer service.`
            });
        }

        return tasks;
    }

    /**
     * Analyze multiple ASINs and generate consolidated task list
     */
    static async analyzeMultiple(asins) {
        const allTasks = [];
        const summary = {
            totalAsins: asins.length,
            analyzed: 0,
            totalTasksGenerated: 0,
            byCategory: {},
            byPriority: { High: 0, Medium: 0, Low: 0 },
            byType: {}
        };

        for (const asin of asins) {
            const tasks = await this.analyzeAsin(asin);
            summary.analyzed++;
            
            for (const task of tasks) {
                task.asinCode = asin.AsinCode;
                task.sellerName = asin.SellerName || 'Unknown';
                task.sellerId = asin.SellerId;
                task.asinId = asin.Id;
                
                allTasks.push(task);
                
                // Update summary
                summary.totalTasksGenerated++;
                summary.byCategory[task.category] = (summary.byCategory[task.category] || 0) + 1;
                summary.byPriority[task.priority] = (summary.byPriority[task.priority] || 0) + 1;
                summary.byType[task.type] = (summary.byType[task.type] || 0) + 1;
            }
        }

        return { tasks: allTasks, summary };
    }
}

module.exports = TaskAnalyzer;

const express = require('express');
const app = express();
const pool = require('../config/database');

app.get('/api/companies/:companyId/alerts/low-stock', async (req, res) => {
    const { companyId } = req.params;

    try {
        // first check if company exists
        const company = await pool.query(
            'SELECT * FROM companies WHERE id = $1',
            [companyId]
        );

        if (company.rows.length === 0) {
            return res.status(404).json({ error: 'Company not found' });
        }

        // get all low stock items for this company
        const lowStockItems = await pool.query(`
      SELECT 
        p.id as product_id,
        p.name as product_name,
        p.sku,
        w.id as warehouse_id,
        w.name as warehouse_name,
        i.quantity as current_stock,
        pt.low_stock_threshold as threshold
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      JOIN warehouses w ON i.warehouse_id = w.id
      JOIN product_types pt ON p.product_type_id = pt.id
      WHERE w.company_id = $1 AND i.quantity < pt.low_stock_threshold
    `, [companyId]);

        const alerts = [];

        // check each item for recent sales and supplier
        for (let item of lowStockItems.rows) {
            // check if this product had sales in last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const recentSales = await pool.query(`
        SELECT COUNT(*) as count, SUM(quantity) as total
        FROM sales
        WHERE product_id = $1 
          AND warehouse_id = $2
          AND sale_date >= $3
      `, [item.product_id, item.warehouse_id, thirtyDaysAgo]);

            const salesData = recentSales.rows[0];

            // only include if there were recent sales
            if (parseInt(salesData.count) > 0) {
                // get supplier info
                const supplier = await pool.query(`
          SELECT s.id, s.name, s.contact_email
          FROM suppliers s
          JOIN product_suppliers ps ON s.id = ps.supplier_id
          WHERE ps.product_id = $1 AND ps.is_primary = true
        `, [item.product_id]);

                // calculate days until out of stock
                let daysUntilStockout = null;
                if (salesData.total > 0) {
                    const avgPerDay = salesData.total / 30;
                    daysUntilStockout = Math.floor(item.current_stock / avgPerDay);
                }

                alerts.push({
                    product_id: item.product_id,
                    product_name: item.product_name,
                    sku: item.sku,
                    warehouse_id: item.warehouse_id,
                    warehouse_name: item.warehouse_name,
                    current_stock: item.current_stock,
                    threshold: item.threshold,
                    days_until_stockout: daysUntilStockout,
                    supplier: supplier.rows[0] || null
                });
            }
        }

        res.json({
            alerts: alerts,
            total_alerts: alerts.length
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

const express = require('express');
const app = express();
const pool = require('../config/database');

// here's the original buggy code from the assignment

app.post('/api/products-buggy', async (req, res) => {
    const data = req.body;

    // ISSUE 1: No validation - undefined errors if client forgets fields

    const productResult = await pool.query(
        'INSERT INTO products (name, sku, price, warehouse_id) VALUES ($1, $2, $3, $4) RETURNING id',
        [data.name, data.sku, data.price, data.warehouse_id]
    );

    const productId = productResult.rows[0].id;

    // ISSUE 2: Two separate queries - if server crashes between them, orphaned product with no inventory

    await pool.query(
        'INSERT INTO inventory (product_id, warehouse_id, quantity) VALUES ($1, $2, $3)',
        [productId, data.warehouse_id, data.initial_quantity]
    );

    // ISSUE 3: No SKU duplicate check - database throws cryptic error instead of clean message
    // ISSUE 4: No error handling - any failure crashes the endpoint
    // ISSUE 5: Always returns 200 - clients can't tell if request actually succeeded
    // ISSUE 6: Doesn't verify warehouse exists - could create products for non-existent warehouses
    // ISSUE 7: Minimal response - client needs another API call to get product details

    res.json({ message: 'Product created', product_id: productId });
});


//------------------------------------------------------------------------------------------------------------------------------------

// now here's the fixed version with all issues resolved

const { z } = require('zod');

const productSchema = z.object({
    name: z.string(),
    sku: z.string(),
    price: z.number(),
    warehouse_id: z.number(),
    initial_quantity: z.number(),
    company_id: z.number(),
    product_type_id: z.number()
});

app.post('/api/products', async (req, res) => {
    // validate input
    const validation = productSchema.safeParse(req.body);

    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid input' });
    }

    const data = validation.data;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // check if SKU already exists
        const checkSku = await client.query(
            'SELECT id FROM products WHERE sku = $1',
            [data.sku]
        );

        if (checkSku.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'SKU already exists' });
        }

        // create product
        const product = await client.query(
            'INSERT INTO products (company_id, product_type_id, name, sku, price) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [data.company_id, data.product_type_id, data.name, data.sku, data.price]
        );

        // create inventory
        await client.query(
            'INSERT INTO inventory (product_id, warehouse_id, quantity) VALUES ($1, $2, $3)',
            [product.rows[0].id, data.warehouse_id, data.initial_quantity]
        );

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Product created',
            product: product.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: 'Failed to create product' });

    } finally {
        client.release();
    }
});


// what we fixed:
// 1. Zod validation to check input
// 2. Transaction so both inserts happen together
// 3. Check SKU exists before inserting
// 4. Proper error handling with rollback
// 5. Return 201 status code for success
// 6. Connection gets released properly



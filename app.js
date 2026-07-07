const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to handle form data and JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Temporary memory array to store submitted tasks
let fieldTasks = [
    { 
        timestamp: new Date().toISOString(), 
        siteId: "DEMO-01", 
        activity: "Preventive Maintenance", 
        notes: "Cleaned rectifier modules and checked DC power levels." 
    }
];

// 1. Main Form Interface (HTML)
app.get('/', (req, res) => {
    let rows = fieldTasks.map(t => `
        <tr>
            <td style="padding:8px; border:1px solid #ddd;">${new Date(t.timestamp).toLocaleString()}</td>
            <td style="padding:8px; border:1px solid #ddd;"><b>${t.siteId}</b></td>
            <td style="padding:8px; border:1px solid #ddd;">${t.activity}</td>
            <td style="padding:8px; border:1px solid #ddd;">${t.notes}</td>
        </tr>
    `).join('');

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Field Task Tracker</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; background-color: #f4f6f9; color: #333; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                input, textarea, select { width: 100%; padding: 10px; margin: 8px 0 16px 0; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
                button { background-color: #007bff; color: white; padding: 12px; border: none; border-radius: 4px; width: 100%; cursor: pointer; font-size: 16px; }
                button:hover { background-color: #0056b3; }
                .download-btn { background-color: #28a745; margin-top: 15px; text-align: center; display: block; text-decoration: none; color: white; padding: 12px; border-radius: 4px; font-weight: bold; }
                .download-btn:hover { background-color: #218838; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; background: white; }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>📋 Field Task Activity Logger</h2>
                <form action="/submit-task" method="POST">
                    <label><b>Site ID:</b></label>
                    <input type="text" name="siteId" placeholder="e.g. BAG-012" required>

                    <label><b>Task Activity Type:</b></label>
                    <select name="activity">
                        <option value="Site Upgrade (2.6 GHz)">Site Upgrade (2.6 GHz)</option>
                        <option value="Preventive Maintenance">Preventive Maintenance</option>
                        <option value="Corrective Maintenance">Corrective Maintenance</option>
                        <option value="Power/Rectifier Check">Power/Rectifier Check</option>
                        <option value="Other Operations">Other Operations</option>
                    </select>

                    <label><b>Activity Details / Notes:</b></label>
                    <textarea name="notes" rows="4" placeholder="Enter status notes, parts replaced, or technician alerts..." required></textarea>

                    <button type="submit">Submit Task Log</button>
                </form>

                <a href="/export-excel" class="download-btn">📥 Download Logs for Excel (.CSV)</a>

                <h3>Recent Logged Activities</h3>
                <table>
                    <tr style="background-color: #eee;">
                        <th style="padding:8px; border:1px solid #ddd; text-align:left;">Time</th>
                        <th style="padding:8px; border:1px solid #ddd; text-align:left;">Site ID</th>
                        <th style="padding:8px; border:1px solid #ddd; text-align:left;">Activity</th>
                        <th style="padding:8px; border:1px solid #ddd; text-align:left;">Notes</th>
                    </tr>
                    ${rows}
                </table>
            </div>
        </body>
        </html>
    `);
});

// 2. Route to handle Form Submission
app.post('/submit-task', (req, res) => {
    const { siteId, activity, notes } = req.body;
    
    // Add the new submission to our online list
    fieldTasks.push({
        timestamp: new Date().toISOString(),
        siteId: siteId.trim().toUpperCase(),
        activity,
        notes: notes.trim()
    });

    // Redirect back to home to see updated list
    res.redirect('/');
});

// 3. Route to Export Data directly into Excel format
app.get('/export-excel', (req, res) => {
    // Add standard CSV headers
    let csvContent = "Timestamp,Site ID,Activity,Notes\n";
    
    // Format row entries safely (replacing quotes/newlines to keep columns clean)
    fieldTasks.forEach(t => {
        let cleanNotes = t.notes.replace(/"/g, '""').replace(/\n/g, ' ');
        csvContent += `"${t.timestamp}","${t.siteId}","${t.activity}","${cleanNotes}"\n`;
    });

    // Set HTTP headers so the browser triggers a file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=Field_Task_Activities.csv');
    
    res.status(200).send(csvContent);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
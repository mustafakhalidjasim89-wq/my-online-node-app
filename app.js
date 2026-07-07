const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const app = express();

const PORT = process.env.PORT || 3000;

// ==========================================
// 1. CONFIGURATIONS & CLOUD SERVICES CODES
// ==========================================
// Replace these placeholders with your real credentials or use Environment Variables
const MONGO_URI = process.env.MONGO_URI || "YOUR_MONGODB_ATLAS_CONNECTION_STRING";
const EMAIL_USER = process.env.EMAIL_USER || "your-company-email@gmail.com";
const EMAIL_PASS = process.env.EMAIL_PASS || "your-gmail-app-password";

// Configure Cloudinary for Image Hosting
cloudinary.config({ 
  cloud_name: process.env.CLOUD_NAME || 'your_cloud_name', 
  api_key: process.env.API_KEY || 'your_api_key', 
  api_secret: process.env.API_SECRET || 'your_api_secret' 
});

// Setup Multer for local temporary file buffering
const upload = multer({ dest: '/tmp/' });

// Connect to Permanent MongoDB Cloud Database
mongoose.connect(MONGO_URI)
  .then(() => console.log("Connected securely to Cloud Database"))
  .catch(err => console.error("Database connection failed:", err));

// Define the Ticket structure
const TicketSchema = new mongoose.Schema({
    ticketId: String,
    siteId: String,
    activity: String,
    notes: String,
    imageUrl: String,
    status: { type: String, default: "Under Progress" }, // Automatic initial status
    timestamp: { type: Date, default: Date.now }
});
const Ticket = mongoose.model('Ticket', TicketSchema);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Setup Email Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

// Helper function to map activity categories to target email addresses
function getDepartmentEmail(activity) {
    switch(activity) {
        case "Power/Rectifier Check":
            return "power-team@company.com";
        case "Admin/Logistics":
            return "admin-team@company.com";
        case "Site Upgrade (2.6 GHz)":
        case "Deployment":
            return "deployment-team@company.com";
        default:
            return "operations-manager@company.com"; // Fallback address
    }
}

// ==========================================
// 2. ROUTES & INTERFACES
// ==========================================

// Dashboard Route: View and manage tickets
app.get('/', async (req, res) => {
    const tickets = await Ticket.find().sort({ timestamp: -1 });
    
    let rows = tickets.map(t => `
        <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding:10px;">${t.ticketId}</td>
            <td style="padding:10px;"><b>${t.siteId}</b></td>
            <td style="padding:10px;"><span style="background:#eee; padding:3px 6px; border-radius:4px;">${t.activity}</span></td>
            <td style="padding:10px;">${t.notes}</td>
            <td style="padding:10px;">
                ${t.imageUrl ? `<a href="${t.imageUrl}" target="_blank"><img src="${t.imageUrl}" width="60" style="border-radius:4px;"/></a>` : 'No Image'}
            </td>
            <td style="padding:10px;">
                <form action="/update-status/${t._id}" method="POST" style="display:inline;">
                    <select name="status" onchange="this.form.submit()" style="padding:5px; border-radius:4px; font-weight:bold; background: ${t.status === 'Fixed' ? '#d4edda' : '#fff3cd'}">
                        <option value="Under Progress" ${t.status === 'Under Progress' ? 'selected' : ''}>Under Progress</option>
                        <option value="Fixed" ${t.status === 'Fixed' ? 'selected' : ''}>Fixed</option>
                    </select>
                </form>
            </td>
        </tr>
    `).join('');

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Company Operations Ticket Dispatcher</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: sans-serif; background: #f0f2f5; margin: 20px; }
                .card { max-width: 900px; margin: 0 auto; background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
                input, select, textarea { width:100%; padding:10px; margin-top:5px; margin-bottom:15px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box;}
                button { background: #0052cc; color:white; padding:12px; border:none; border-radius:4px; font-weight:bold; width:100%; cursor:pointer;}
                table { width:100%; border-collapse:collapse; margin-top:25px; }
                th { background:#f4f5f7; text-align:left; padding:10px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>⚠️ Open a New Site Ticket</h2>
                <form action="/raise-ticket" method="POST" enctype="multipart/form-data">
                    <label><b>Site ID:</b></label>
                    <input type="text" name="siteId" placeholder="e.g. IRQ-782" required />

                    <label><b>Department / Issue Category:</b></label>
                    <select name="activity">
                        <option value="Power/Rectifier Check">Power/Rectifier Check (Sends to Power Team)</option>
                        <option value="Admin/Logistics">Admin/Logistics (Sends to Admin Team)</option>
                        <option value="Site Upgrade (2.6 GHz)">Site Upgrade / Deployment (Sends to Deployment Team)</option>
                    </select>

                    <label><b>Detailed Situation Notes:</b></label>
                    <textarea name="notes" rows="3" required></textarea>

                    <label><b>Attach Field Site Picture:</b></label>
                    <input type="file" name="image" accept="image/*" required />

                    <button type="submit">Raise Ticket</button>
                </form>

                <hr style="margin:30px 0; border:0; border-top:1px solid #ddd;"/>
                
                <h3>Live Network Tickets Monitor</h3>
                <table>
                    <tr>
                        <th>Ticket ID</th>
                        <th>Site ID</th>
                        <th>Category</th>
                        <th>Notes</th>
                        <th>Picture</th>
                        <th>Status</th>
                    </tr>
                    ${rows}
                </table>
            </div>
        </body>
        </html>
    `);
});

// Route to handle dynamic ticket creation, image uploading, and email dispatching
app.post('/raise-ticket', upload.single('image'), async (req, res) => {
    try {
        const { siteId, activity, notes } = req.body;
        
        // Generate unique readable Ticket ID
        const ticketId = "TK-" + Math.floor(1000 + Math.random() * 9000);
        
        // Upload the file image safely to Cloudinary Cloud storage
        let imageUrl = "";
        if (req.file) {
            const result = await cloudinary.uploader.upload(req.file.path);
            imageUrl = result.secure_url;
        }

        // Save Ticket parameters safely to MongoDB
        const newTicket = new Ticket({
            ticketId,
            siteId: siteId.toUpperCase().trim(),
            activity,
            notes,
            imageUrl,
            status: "Under Progress" // Automatic assignment
        });
        await newTicket.save();

        // Target Specific Email Recipients Based on Category selection
        const recipientEmail = getDepartmentEmail(activity);

        const emailOptions = {
            from: EMAIL_USER,
            to: recipientEmail,
            subject: `[${newTicket.status}] Ticket ${ticketId} raised for Site ${newTicket.siteId}`,
            html: `
                <h3>New Ticket Dispatched Automatically</h3>
                <p><b>Ticket ID:</b> ${ticketId}</p>
                <p><b>Site ID:</b> ${newTicket.siteId}</p>
                <p><b>Category:</b> ${activity}</p>
                <p><b>Current Status:</b> Under Progress</p>
                <p><b>Field Notes:</b> ${notes}</p>
                ${imageUrl ? `<p><b>Field Photo Attached:</b> <br/><img src="${imageUrl}" width="400"/></p>` : ""}
            `
        };

        // Fire Email async
        transporter.sendMail(emailOptions, (err, info) => {
            if (err) console.error("Email Routing Error:", err);
            else console.log("Alert email pushed to: " + recipientEmail);
        });

        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.status(500).send("Error compiling ticket application execution flow.");
    }
});

// Route to modify/update status later from the dropdown options
app.post('/update-status/:id', async (req, res) => {
    const { status } = req.body;
    await Ticket.findByIdAndUpdate(req.params.id, { status });
    res.redirect('/');
});

app.listen(PORT, () => console.log(`System initialized running on port ${PORT}`));
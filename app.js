const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const app = express();
const PORT = process.env.PORT || 3000;

const MONGO_URI = process.env.MONGO_URI;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

cloudinary.config({ 
  cloud_name: process.env.CLOUD_NAME, 
  api_key: process.env.API_KEY, 
  api_secret: process.env.API_SECRET 
});

const upload = multer({ dest: '/tmp/' });

mongoose.connect(MONGO_URI)
  .then(function() { console.log("Connected securely to Cloud Database"); })
  .catch(function(err) { console.error("Database connection failed:", err); });

const TicketSchema = new mongoose.Schema({
    ticketId: String,
    siteId: String,
    activity: String,
    notes: String,
    imageUrl: String,
    status: { type: String, default: "Under Progress" }, 
    timestamp: { type: Date, default: Date.now }
});
const Ticket = mongoose.model('Ticket', TicketSchema);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

function getDepartmentEmail(activity) {
    if (activity === "Power/Rectifier Check") return "power-team@company.com";
    if (activity === "Admin/Logistics") return "admin-team@company.com";
    if (activity === "Site Upgrade (2.6 GHz)") return "deployment-team@company.com";
    return "operations-manager@company.com";
}

// Main page setup using simple quotes to prevent syntax bugs
app.get('/', async (req, res) => {
    try {
        const tickets = await Ticket.find().sort({ timestamp: -1 });
        
        let rows = "";
        tickets.forEach(function(t) {
            let rowColor = (t.status === "Fixed") ? "#f8fdef" : "#ffffff";
            let selectColor = (t.status === "Fixed") ? "#d4edda; color: #155724;" : "#fff3cd; color: #856404;";
            let imgCell = t.imageUrl ? "<a href='" + t.imageUrl + "' target='_blank'><img src='" + t.imageUrl + "' width='70' style='border-radius:4px;'/></a>" : "<span>No Image</span>";
            
            rows += "<tr style='border-bottom: 1px solid #ddd; background: " + rowColor + ";'>" +
                    "<td style='padding:12px;'><b>" + t.ticketId + "</b></td>" +
                    "<td style='padding:12px; color: #0052cc;'><b>" + t.siteId + "</b></td>" +
                    "<td style='padding:12px;'><span style='background:#e4e6eb; padding:4px 8px; border-radius:4px;'>" + t.activity + "</span></td>" +
                    "<td style='padding:12px;'>" + t.notes + "</td>" +
                    "<td style='padding:12px;'>" + imgCell + "</td>" +
                    "<td style='padding:12px;'>" +
                        "<form action='/update-status/" + t._id + "' method='POST' style='display:inline;'>" +
                            "<select name='status' onchange='this.form.submit()' style='padding:6px; border-radius:4px; font-weight:bold; background: " + selectColor + "'>" +
                                "<option value='Under Progress' " + (t.status === "Under Progress" ? "selected" : "") + ">Under Progress</option>" +
                                "<option value='Fixed' " + (t.status === "Fixed" ? "selected" : "") + ">Fixed</option>" +
                            "</select>" +
                        "</form>" +
                    "</td>" +
                   "</tr>";
        });

        if (rows === "") {
            rows = "<tr><td colspan='6' style='padding:20px; text-align:center; color:#94a3b8;'>No active tickets found.</td></tr>";
        }

        let htmlPage = "<!DOCTYPE html><html><head><title>Operations Dispatcher</title><meta name='viewport' content='width=device-width, initial-scale=1'>" +
            "<style>body { font-family: sans-serif; background: #f4f6f9; margin: 0; padding: 20px; }" +
            ".card { max-width: 1000px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }" +
            "label { font-weight: bold; display: block; margin-top: 15px; color: #475569; }" +
            "input, select, textarea { width:100%; padding:12px; margin-top:6px; margin-bottom:10px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box; }" +
            "button { background: #0052cc; color:white; padding:14px; border:none; border-radius:6px; font-weight:bold; width:100%; cursor:pointer; font-size: 16px; }" +
            "table { width:100%; border-collapse:collapse; margin-top:35px; }" +
            "th { background:#f1f5f9; text-align:left; padding:12px; color: #64748b; border-bottom: 2px solid #cbd5e1; }</style></head>" +
            "<body><div class='card'><h2>⚠️ Open New Site Ticket</h2>" +
            "<form action='/raise-ticket' method='POST' enctype='multipart/form-data'>" +
            "<label>Site ID</label><input type='text' name='siteId' placeholder='e.g. BAG-014' required />" +
            "<label>Department / Issue Category</label><select name='activity'>" +
            "<option value='Power/Rectifier Check'>Power/Rectifier Check (Sends to Power Team)</option>" +
            "<option value='Admin/Logistics'>Admin/Logistics (Sends to Admin Team)</option>" +
            "<option value='Site Upgrade (2.6 GHz)'>Site Upgrade (2.6 GHz) (Sends to Deployment Team)</option></select>" +
            "<label>Detailed Situation Notes</label><textarea name='notes' rows='3' placeholder='Describe issue...' required></textarea>" +
            "<label>Attach Field Site Picture</label><input type='file' name='image' accept='image/*' required />" +
            "<button type='submit'>Submit & Dispatch Ticket</button></form>" +
            "<hr style='margin:40px 0; border:0; border-top:1px solid #e2e8f0;'/>" +
            "<h3>Live Network Tickets Monitor</h3><div style='overflow-x:auto;'><table>" +
            "<tr><th>Ticket ID</th><th>Site ID</th><th>Category</th><th>Notes</th><th>Picture</th><th>Status</th></tr>" +
            rows + "</table></div></div></body></html>";

        res.send(htmlPage);
    } catch (err) {
        res.status(500).send("Error compiling dashboard data.");
    }
});

app.post('/raise-ticket', upload.single('image'), async (req, res) => {
    try {
        const { siteId, activity, notes } = req.body;
        const ticketId = "TK-" + Math.floor(1000 + Math.random() * 9000);
        
        let imageUrl = "";
        if (req.file) {
            const result = await cloudinary.uploader.upload(req.file.path);
            imageUrl = result.secure_url;
        }

        const newTicket = new Ticket({
            ticketId,
            siteId: siteId.toUpperCase().trim(),
            activity,
            notes,
            imageUrl,
            status: "Under Progress" 
        });
        await newTicket.save();

        const recipientEmail = getDepartmentEmail(activity);

        let emailHtml = "<div style='font-family: Arial; border: 1px solid #eee; padding: 20px; border-radius: 8px;'>" +
            "<h2 style='color: #0052cc;'>New Dispatch Ticket Alert</h2>" +
            "<p><b>Ticket ID:</b> " + ticketId + "</p>" +
            "<p><b>Site ID:</b> " + newTicket.siteId + "</p>" +
            "<p><b>Category:</b> " + activity + "</p>" +
            "<p><b>Status:</b> Under Progress</p>" +
            "<p><b>Field Notes:</b> " + notes + "</p>";
        if (imageUrl) {
            emailHtml += "<p><b>Field Photo:</b><br/><img src='" + imageUrl + "' width='400'/></p>";
        }
        emailHtml += "</div>";

        const emailOptions = {
            from: EMAIL_USER,
            to: recipientEmail,
            subject: "[" + newTicket.status + "] Ticket " + ticketId + " Raised for Site " + newTicket.siteId,
            html: emailHtml
        };

        transporter.sendMail(emailOptions, (err, info) => {
            if (err) console.error("Email dispatch failed:", err);
            else console.log("Alert email sent.");
        });

        res.redirect('/');
    } catch (error) {
        console.error("Critical execution error:", error);
        res.status(500).send("Internal processing server error.");
    }
});

app.post('/update-status/:id', async (req, res) => {
    try {
        const { status } = req.body;
        await Ticket.findByIdAndUpdate(req.params.id, { status });
        res.redirect('/');
    } catch (err) {
        res.status(500).send("Error updating ticket status.");
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log("System initialized running on port " + PORT);
});

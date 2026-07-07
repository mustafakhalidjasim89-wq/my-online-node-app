const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const app = express();

const PORT = process.env.PORT || 3000;

// Gather credentials securely from Render Environment panel
const MONGO_URI = process.env.MONGO_URI;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

cloudinary.config({ 
  cloud_name: process.env.CLOUD_NAME, 
  api_key: process.env.API_KEY, 
  api_secret: process.env.API_SECRET 
});

const upload = multer({ dest: '/tmp/' });

// Track if Database is successfully connected
let isDatabaseConnected = false;

// Backup memory array to store tickets safely if MongoDB connection drops
let backupTicketsArray = [
    {
        _id: "backup_demo",
        ticketId: "TK-0000",
        siteId: "SYSTEM-OK",
        activity: "System Test",
        notes: "Cloud system engine running smoothly.",
        imageUrl: "",
        status: "Under Progress",
        timestamp: new Date()
    }
];

// Attempt Cloud Database connection safely
if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
      .then(function() { 
          console.log("Connected securely to Cloud Database"); 
          isDatabaseConnected = true;
      })
      .catch(function(err) { 
          console.error("Database connection failed, running on memory backup:", err.message); 
          isDatabaseConnected = false;
      });
} else {
    console.log("No MONGO_URI provided. Running strictly on local memory engine backup.");
}

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

// All categories now explicitly route to your requested inbox
function getDepartmentEmail(activity) {
    return "MUSTAFAKHALIDJASIM89@GMAIL.COM";
}

// ==========================================
// ROUTE: EXPORT DATA TO CSV (EXCEL)
// ==========================================
app.get('/export-csv', async (req, res) => {
    try {
        let tickets = [];
        if (isDatabaseConnected) {
            tickets = await Ticket.find().sort({ timestamp: -1 });
        } else {
            tickets = backupTicketsArray;
        }

        // Create CSV Headers
        let csvContent = "Ticket ID,Site ID,Category,Notes,Status,Date Created,Image URL\n";
        
        // Append rows securely formatting strings to avoid breakage
        tickets.forEach(function(t) {
            let cleanNotes = t.notes.replace(/"/g, '""').replace(/\n/g, ' ');
            let formattedDate = new Date(t.timestamp).toISOString().split('T')[0];
            csvContent += `"${t.ticketId}","${t.siteId}","${t.activity}","${cleanNotes}","${t.status}","${formattedDate}","${t.imageUrl || 'No Image'}"\n`;
        });

        // Tell browser to download the file directly
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=Operational_Tickets_Report.csv');
        res.status(200).send(csvContent);
    } catch (err) {
        res.status(500).send("Error exporting analytical spreadsheet data.");
    }
});

// ==========================================
// CORE SYSTEM OPERATIONS DASHBOARD
// ==========================================
app.get('/', async (req, res) => {
    try {
        let tickets = [];
        
        if (isDatabaseConnected) {
            try {
                tickets = await Ticket.find().sort({ timestamp: -1 });
            } catch (dbErr) {
                tickets = backupTicketsArray;
            }
        } else {
            tickets = backupTicketsArray;
        }
        
        let rows = "";
        tickets.forEach(function(t) {
            let rowColor = (t.status === "Fixed") ? "#f8fdef" : "#ffffff";
            let selectColor = (t.status === "Fixed") ? "#d4edda; color: #155724;" : "#fff3cd; color: #856404;";
            let imgCell = t.imageUrl ? "<a href='" + t.imageUrl + "' target='_blank'><img src='" + t.imageUrl + "' width='70' style='border-radius:4px;'/></a>" : "<span style='color:#aaa;'>No Image</span>";
            
            rows += "<tr style='border-bottom: 1px solid #ddd; background: " + rowColor + ";'>" +
                    "<td style='padding:12px;'><b>" + t.ticketId + "</b></td>" +
                    "<td style='padding:12px; color: #0052cc;'><b>" + t.siteId + "</b></td>" +
                    "<td style='padding:12px;'><span style='background:#e4e6eb; padding:4px 8px; border-radius:4px; font-size:13px;'>" + t.activity + "</span></td>" +
                    "<td style='padding:12px; max-width:250px; word-wrap:break-word;'>" + t.notes + "</td>" +
                    "<td style='padding:12px;'>" + imgCell + "</td>" +
                    "<td style='padding:12px;'>" +
                        "<form action='/update-status/" + t._id + "' method='POST' style='display:inline;'>" +
                            "<select name='status' onchange='this.form.submit()' style='padding:6px; border-radius:4px; font-weight:bold; cursor:pointer; background: " + selectColor + "'>" +
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
            "input, select, textarea { width:100%; padding:12px; margin-top:6px; margin-bottom:10px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box; font-size:14px; }" +
            "button { background: #0052cc; color:white; padding:14px; border:none; border-radius:6px; font-weight:bold; width:100%; cursor:pointer; font-size: 16px; }" +
            ".btn-export { background: #10b981; margin-bottom: 20px; float: right; width:
<div align="center">

# 💰 Odoo CSTD Forecast Application

[![macOS](https://img.shields.io/badge/macOS-compatible-brightgreen?logo=apple&logoColor=white)](https://www.apple.com/macos/)
[![Windows](https://img.shields.io/badge/Windows-compatible-brightgreen?logo=windows&logoColor=white)](https://www.microsoft.com/windows/)
[![Linux](https://img.shields.io/badge/Linux-compatible-brightgreen?logo=linux&logoColor=white)](https://www.linux.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Odoo](https://img.shields.io/badge/Powered_by-Odoo-875A7B?logo=odoo&logoColor=white)](https://www.odoo.com)

</div>

> **Note**: This is an unofficial tool and is not affiliated with or endorsed by Odoo S.A.

---


A comprehensive tool for tracking and forecasting Odoo subscriptions, renewals, upsells, and success packs. This application runs locally in your browser without requiring any server setup.

## 📥 Installation Guide

Follow these step-by-step instructions to get the Odoo CSTD Forecast application running on your machine:

### 📥 Step 1: Download the Application

1. Go to the GitHub repository https://github.com/onlybets/odoo-ddem-forecast-app-v3
2. Click on the green "Code" button and select "Download ZIP"
3. Once downloaded, extract the ZIP file to a location of your choice (e.g., Documents folder)

🚀 Step 2: Launch the Application

1. Navigate to the extracted folder
2. Open the `index.html` file in your web browser
3. The application will load in your browser and is ready to use

## ⚙️ Setting Up the Application

📤 Step 1: Export Your Odoo Subscription Data

1. Log into your Odoo account
2. Navigate to the "Subscriptions" app
3. Display all subscriptions

4. Click on the "Cog" button and select "Spreadsheet" ->"Insert list in spreadsheet" -> "Blank spreadsheet" -> "Confirm"
5. Download the XLSX file to your computer. "File" -> "Download"

📥 Step 2: Import Subscription Data

1. In the Odoo CSTD Forecast application, click on the "Settings" tab
2. In the "Import from Excel" section, click the "Choose File" button
3. Select the XLSX file you downloaded from Odoo
4. Click the "Import" button
5. Wait for the confirmation message that the import was successful

#### Required Columns in XLSX File

The imported XLSX file must contain the following columns (the order doesn't matter):

- **Customer** - Client name
- **Next Invoice** - Next renewal date
- **Total Recurring** - Total recurring amount with currency symbol
- **Recurring Plan** - Subscription frequency (Monthly, Yearly, etc.)
- **Subscription Status** - Current status of the subscription

> **Important**: The XLSX import is typically only needed for the initial setup. For subsequent changes, use the application's interface to add, edit, or delete clients and their subscriptions through the respective tabs (Clients, Renewals, Upsells, etc.).

## 💻 Using the Application

The application is organized into several tabs, each with specific functionality:

📊 Dashboard Tab

- Provides an overview of your performance metrics by month
- Shows renewal performance, upsell activity, and success pack metrics
- Compares actual performance against targets

👥 Clients Tab

- Lists all your clients with their subscription details
- Allows you to add new clients or renew existing ones
- Displays client subscription status and renewal dates

🔄 Renewals Tab

- Tracks all renewal opportunities
- Shows renewal status, amounts, and target contributions
- Allows adjusting targets for specific renewals

📈 Upsells Tab

- Records all upsell opportunities for existing clients
- Tracks upsell performance and contribution to targets
- Allows adding and editing upsell information

⭐️ Success Packs Tab

- Manages success pack sales and renewals
- Tracks performance against success pack targets
- Records client-specific success pack information

🎯 Targets Tab

- Sets monthly targets for renewals, upsells, and success packs
- Provides tools for planning and forecasting
- Allows adjusting targets based on performance

⚙️ Settings Tab

- Import data from Odoo XLSX exports
- Export your data as JSON for backup purposes
- Import previously exported JSON data
- Reset application data if needed

💾 Data Management

- All data is stored locally in your browser's localStorage
- Use the Export/Import JSON feature in Settings to backup and restore your data
- The application automatically fetches current currency conversion rates

💱 Currency Conversion

The application automatically converts all currencies to USD for consistent reporting using current exchange rates from taux.live.

📴 Offline Use

Once loaded, the application can work offline, though currency conversion rates will not update until you're back online.

🔒 Privacy & Security

All your data remains on your local machine and is never transmitted to any servers.

🔧 Troubleshooting

If you encounter issues:
- Make sure your browser allows JavaScript and localStorage
- Try clearing your browser cache if data doesn't appear to be saving
- Export your data regularly as a backup precaution

---

📧 For support or feature requests, please contact ddem@odoo.com

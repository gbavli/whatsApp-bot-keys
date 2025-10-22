# Railway Quick Fix Instructions

## URGENT: Fix WhatsApp Bot 405 Errors

### Problem:
- Bot stuck in 405 "Method Not Allowed" loop
- Session needs to be cleared but script not running
- Railway running wrong startup command

### Solution Steps:

1. **Go to Railway Dashboard**
   - Open your WhatsApp bot project
   - Click "Settings" tab

2. **Update Start Command**
   - Scroll to "Deploy" section
   - Find "Custom Start Command" field
   - Set to: `node clear-and-start.js`
   - Click "Save"

3. **Remove CLEAR_SESSION Variable (if exists)**
   - Go to "Variables" tab
   - Delete `CLEAR_SESSION` variable if present
   - We don't need it anymore

4. **Force Redeploy**
   - Go to "Deployments" tab
   - Click "Redeploy" or "Deploy Latest"
   - Wait for deployment to complete

5. **Watch Logs for:**
   ```
   🔄 Clearing WhatsApp session...
   🗑️ Deleted: [files]
   ✅ Session cleared successfully!
   🔳 QR CODE FOR WHATSAPP:
   ```

6. **Scan New QR Code**
   - Copy QR URL from logs
   - Scan with WhatsApp

### If Start Command Field Not Available:
Add as Environment Variable instead:
- Name: `START_COMMAND`
- Value: `node clear-and-start.js`

This will force clear the WhatsApp session and generate a new QR code to fix the 405 errors.
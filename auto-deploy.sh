#!/bin/bash
echo "🚀 AUTO-DEPLOY TELEGRAM BOT TO RAILWAY"
echo "======================================="

# Try multiple git push methods
echo "📤 Attempting to push to GitHub..."

# Method 1: Try regular push
echo "Method 1: Regular git push..."
if git push origin main 2>/dev/null; then
    echo "✅ Success! Railway will auto-deploy."
    exit 0
fi

# Method 2: Try with credentials
echo "Method 2: Checking git credentials..."
git config --list | grep user

echo ""
echo "❌ Git push failed. Manual steps needed:"
echo "======================================="
echo ""
echo "🔧 MANUAL DEPLOYMENT STEPS:"
echo "1. Go to: https://github.com/gbavli/whatsApp-bot-keys"
echo "2. Upload these files from your computer:"
echo "   - railway-simple-start.js"
echo "   - railway.toml (replace existing)"
echo ""
echo "📁 Files are ready in: $(pwd)"
echo ""
echo "🎯 After upload:"
echo "- Railway will automatically deploy"
echo "- Telegram bot will work with PostgreSQL"
echo "- Price updates will function properly!"
echo ""
echo "🤖 Your bot: @KeyPricingBot"
echo ""
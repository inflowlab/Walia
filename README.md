# Walia - Secure File Storage Made Simple

Walia is a user-friendly file storage system that lets you securely store, share, and manage your files on the decentralized Walrus network. Think of it like a secure cloud storage service, but powered by blockchain technology for better privacy and control.

## What is Walia?

Walia helps you:
- **Store files securely** - Your files are encrypted and stored on a decentralized network
- **Control who sees what** - Decide exactly who can access your files
- **Chat with a bot** - Use our Telegram bot to manage files with simple messages
- **Keep costs low** - Pay only for what you store, with transparent pricing

## How does it work?

1. **Upload your files** - Through our Telegram bot or command line interface
2. **Files get encrypted** - Your data is protected before being stored
3. **Access control** - You decide who can read your files
4. **Retrieve anytime** - Get your files back whenever you need them

## Getting Started

### Option 1: Telegram Bot (Easiest)
The simplest way to use Walia is through our Telegram bot:

1. Find our bot on Telegram: [@WaliaStorageBot](https://t.me/walia_storage_bot)
2. Send `/start` to begin
3. Follow the setup instructions
4. Start storing files by simply sending them to the bot!

### Option 2: Command Line Interface
For more advanced users:

1. **Install the software**:
   ```bash
   git clone https://github.com/yourusername/walia.git
   cd walia
   npm install
   ```

2. **Set up your wallet**:
   ```bash
   npm run create-dev-wallet
   ```

3. **Start using Walia**:
   ```bash
   # Store a file
   npm run cli store '{"filePath":"./my-document.pdf","epochs":5}'
   
   # List your files
   npm run cli list-blobs
   ```

## Key Features

### 🔐 **Secure by Design**
- All files are encrypted before storage
- You control the encryption keys
- No one can access your files without permission

### 🤖 **Telegram Bot Integration**
- Store files by simply sending them to our bot
- Manage files with natural language commands
- "Store this document for 6 months"
- "List all my photos from this year"

### 💰 **Transparent Pricing**
- Pay only for storage time and space used
- Get cost estimates before storing files
- No hidden fees or surprise charges

### 🌐 **Decentralized Storage**
- Files stored on the Walrus network
- No single point of failure
- Your data stays available even if we go offline

### 🔑 **Access Control**
- Create permission lists for your files
- Share files securely with specific people
- Revoke access anytime

## What You Can Do

### Store Files
- Upload documents, images, videos, or any file type
- Choose how long to store them (epochs)
- Get a unique ID to retrieve them later

### Manage Access
- Create whitelists of people who can access your files
- Add or remove people from access lists
- Transfer file ownership to others

### Monitor Usage
- Check your storage costs
- See how much space you're using
- View your file history

## Technical Components

Walia consists of three main parts:

1. **Telegram Bot** - The user-friendly interface for everyday file management
2. **Storage System** - Handles encryption, storage, and retrieval of files
3. **Smart Contracts** - Manages access permissions and ownership on the blockchain

## Support

Need help? Here are your options:

- **Telegram Support**: Message our bot with questions
- **Documentation**: Check our detailed guides in the `docs/` folder
- **Community**: Join our community discussions
- **Issues**: Report problems on our GitHub page

## Privacy & Security

Your privacy is our priority:
- Files are encrypted before leaving your device
- We never see your file contents
- You control all access permissions
- Decentralized storage means no central authority

## Getting Help

For detailed technical setup instructions, see our [Setup Guide](SETUP_GUIDE.md).

For contributing to the project, see our [Contributing Guide](CONTRIBUTING.md).

## License

ISC - Open source and free to use
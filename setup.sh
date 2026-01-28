#!/bin/bash

echo "🎫 Klever Support Setup Script"
echo "=============================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL not found. Please ensure PostgreSQL is installed and running."
fi

echo ""
echo "📦 Installing dependencies..."
echo ""

# Install root dependencies
npm install

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend
npm install

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd ../frontend
npm install

cd ..

echo ""
echo "✅ Dependencies installed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Set up Clerk account at https://clerk.com"
echo "2. Copy backend/.env.example to backend/.env and add your Clerk keys"
echo "3. Copy frontend/.env.example to frontend/.env and add your Clerk publishable key"
echo "4. Create PostgreSQL database: createdb ticket_system"
echo "5. Run database migrations: cd backend && npm run db:migrate"
echo "6. Start the development servers: npm run dev"
echo ""
echo "For detailed instructions, see README.md"

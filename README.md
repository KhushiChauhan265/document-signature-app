# DOCUMENT-SIGNATURE-APP

## Project Overview
DOCUMENT-SIGNATURE-APP is a full-stack web application that allows users to securely upload PDF documents, place signature fields, and send signing requests through email. The platform simplifies the document signing process by letting users manage documents digitally instead of printing, scanning, and sharing files manually.

## Features
- Secure PDF upload and storage
- Drag-and-drop signature field placement
- Email invitation flow for signers
- Authentication and user dashboard
- Document tracking and status updates
- Signed PDF download after completion

## Tech Stack
### Frontend
- React.js
- Vite
- Tailwind CSS
- react-pdf
- @dnd-kit

### Backend
- Node.js
- Express.js
- pdf-lib
- JWT Authentication

### Database
- MongoDB Atlas

### Cloud Services
- Supabase Storage
- Brevo API

### Deployment
- Frontend: Vercel
- Backend: Render

## System Workflow
1. The user logs in and uploads a PDF document.
2. The file is stored in cloud storage and the metadata is saved in MongoDB Atlas.
3. The user opens the document editor and places signature fields on the PDF.
4. The user enters signer details and sends an invitation.
5. The backend generates a secure signing link and sends it through Brevo.
6. The signer opens the link, signs the document, and submits it.
7. The signed document is finalized and made available for download.

## Deployment Links
- Live Frontend: https://document-signature-applabmentix.vercel.app/
- Live Backend: https://document-signature-app-iqih.onrender.com
- GitHub Repository: https://github.com/KhushiChauhan265/document-signature-app

## Local Installation

### 1. Clone the repository
```bash
git clone https://github.com/KhushiChauhan265/document-signature-app
cd document-signature-app
```

### 2. Backend setup
```bash
cd backend
npm install
npm run dev
```

### 3. Frontend setup
```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

### Backend `.env`
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
BREVO_API_KEY=your_brevo_api_key
EMAIL_FROM=your_verified_sender_email
FRONTEND_URL=your_frontend_url
```

### Frontend `.env`
```env
VITE_API_URL=your_backend_url
```

## Challenges Faced
- Managing PDF signature coordinates correctly between frontend and backend
- Configuring cloud storage for uploaded documents
- Handling email sender verification and invite delivery
- Fixing production environment variable issues during deployment
- Testing the complete flow across frontend, backend, database, and storage

## Final Result
This project was successfully deployed and tested as a complete full-stack document signing platform. It integrates a React frontend, Express backend, MongoDB Atlas, Supabase Storage, and Brevo email services to provide a working digital document signing workflow.

## Future Improvements
- Add email reminders for pending signatures
- Add audit logs and signing history
- Improve mobile signing experience
- Add document expiration and advanced admin controls
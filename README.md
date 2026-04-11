# NeedIt Backend

Backend API for **NeedIt** — a reverse marketplace platform where buyers post what they need and sellers compete to offer the best deals.

---

## 🚀 Live Product

- Frontend: pending
- Backend API: pending
- Domain: needit.ng _(pending connection)_

---

## 🧠 What is NeedIt?

NeedIt flips traditional marketplaces.

Instead of sellers listing products:

- Buyers post what they need
- Sellers compete with offers
- Buyers choose the best deal

> Built specifically for the Nigerian market 🇳🇬 — Naira pricing, local cities, real-world use cases.

---

## ✨ Core Features

### 🔐 Authentication

- JWT-based authentication
- Register / Login
- Role-based users (buyer, seller)

### 🛒 Needs

- Post needs (title, description, budget, urgency)
- Attach images via Cloudinary
- Browse and filter needs

### 💸 Offers

- Sellers submit offers on needs
- Buyers receive and review offers

### 💬 Real-time Chat

- Buyer ↔ Seller messaging (Socket.io)
- Unread message indicators
- Conversation tracking

---

## 🏗️ Tech Stack

| Layer     | Technology                             |
| --------- | -------------------------------------- |
| Backend   | NestJS                                 |
| Language  | TypeScript                             |
| Database  | (Drizzle ORM / Postgres or your setup) |
| Auth      | JWT + bcryptjs                         |
| Real-time | Socket.io                              |
| Storage   | Cloudinary                             |
| Hosting   | Render                                 |

---

## ⚙️ Project Setup

```bash
npm install
```

---

## ▶️ Run the app

```bash
# development
npm run dev

# production
npm run start:prod
```

---

## 🧪 Testing

```bash
# unit tests
npm run test

# watch mode
npm run test:watch

# coverage
npm run test:cov
```

---

## 🧪 CI/CD

GitHub Actions runs:

- ✅ Lint checks
- ✅ Unit tests

On every push and pull request.

---

## 📂 Project Structure

```bash
src/
  modules/
    auth/
    users/
  infrastructure/
    drizzle/
```

---

## 🔐 Environment Variables

Create a `.env` file:

```env
JWT_SECRET=your_secret
JWT_REFRESH_SECRET=your_refresh_secret
DATABASE_URL=your_db_url
```

---

## 📈 Roadmap

### Phase 1 (MVP) ✅

- Auth
- Needs & Offers
- Real-time chat

### Phase 2 🚧

- Email notifications
- Password reset
- Advanced filters

### Phase 3 💰

- Payments (Paystack)
- Escrow system
- Ratings & reviews

---

## 🎯 Vision

> A marketplace where buyers are in control and sellers compete for demand.
# stats

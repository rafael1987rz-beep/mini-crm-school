const express = require('express');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const path = require('path');

const prisma = new PrismaClient();
const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

// 1. Ученики: CRUD
app.get('/students', async (req, res) => {
  const students = await prisma.student.findMany();
  res.json(students);
});

app.post('/students', async (req, res) => {
  try {
    const { name, phone, group, monthlyFee } = req.body;
    const student = await prisma.student.create({
      data: { name, phone, group, monthlyFee: parseFloat(monthlyFee) }
    });
    res.status(201).json(student);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, group, monthlyFee } = req.body;
    const student = await prisma.student.update({
      where: { id: parseInt(id) },
      data: { name, phone, group, monthlyFee: monthlyFee ? parseFloat(monthlyFee) : undefined }
    });
    res.json(student);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.student.delete({ where: { id: parseInt(id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2. Оплаты: добавление и список по ученику
app.post('/payments', async (req, res) => {
  try {
    const { studentId, amount, date } = req.body;
    const payment = await prisma.payment.create({
      data: {
        studentId: parseInt(studentId),
        amount: parseFloat(amount),
        date: date ? new Date(date) : new Date()
      }
    });
    res.status(201).json(payment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/payments', async (req, res) => {
  const { studentId } = req.query;
  const payments = await prisma.payment.findMany({
    where: studentId ? { studentId: parseInt(studentId) } : {}
  });
  res.json(payments);
});

// 3. Запрос «должники за месяц» (GET /debtors?month=YYYY-MM)
app.get('/debtors', async (req, res) => {
  try {
    const { month } = req.query; 
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Укажите месяц в формате YYYY-MM' });
    }

    const [year, m] = month.split('-').map(Number);
    const startDate = new Date(year, m - 1, 1);
    const endDate = new Date(year, m, 1);

    const students = await prisma.student.findMany({
      include: {
        payments: {
          where: {
            date: {
              gte: startDate,
              lt: endDate
            }
          }
        }
      }
    });

    const debtors = [];

    for (const student of students) {
      const totalPaid = student.payments.reduce((sum, p) => sum + p.amount, 0);
      if (totalPaid < student.monthlyFee) {
        debtors.push({
          id: student.id,
          name: student.name,
          phone: student.phone,
          group: student.group,
          monthlyFee: student.monthlyFee,
          paid: totalPaid,
          debt: student.monthlyFee - totalPaid
        });
      }
    }

    res.json(debtors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

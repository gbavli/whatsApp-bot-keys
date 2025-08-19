const express = require('express');
const getVehicleInfo = require('./getVehicleInfo');

const app = express();
app.use(express.json());

app.post('/get-price', async (req, res) => {
  const { make, model, year } = req.body;

  try {
    const price = getVehicleInfo(make, model, year);
    if (price) {
      res.json({ message: price });
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`📡 API Server running on port ${PORT}`);
});
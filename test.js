const getVehicleInfo = require('./getVehicleInfo');

async function runTest() {
  const make = 'Chevrolet';
  const model = 'Camaro';
  const year = 2007; // שנה שלא קיימת בטווח, בדיקה לפי קובץ Excel

  const result = await getVehicleInfo(make, model, year);

  if (result) {
    console.log(result);
  } else {
    console.log('No matching record found for that vehicle.');
  }
}

runTest();
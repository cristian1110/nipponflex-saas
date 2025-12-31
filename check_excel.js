const XLSX = require('xlsx');
const workbook = XLSX.readFile('/mnt/user-data/uploads/Copia_de_Contacts-31-dic-08-13_1_.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
console.log('Columnas:', data[0]);
console.log('Primeras 3 filas:');
data.slice(1, 4).forEach((row, i) => console.log('Fila ' + (i+1) + ':', row));
console.log('Total filas:', data.length - 1);

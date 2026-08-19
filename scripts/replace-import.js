const fs = require('fs');
const p = 'src/routes/admin.tsx';
let s = fs.readFileSync(p, 'utf8');
const oldLine = 'import PremiumDashboardPage from "@/components/admin/PremiumDashboard";';
const newLine = 'import PremiumDashboardPage from "@/components/admin/Dashboard";';
if (s.includes(oldLine)) {
  s = s.replace(oldLine, newLine);
  fs.writeFileSync(p, s);
  console.log('replaced');
} else {
  console.log('old line not found');
}

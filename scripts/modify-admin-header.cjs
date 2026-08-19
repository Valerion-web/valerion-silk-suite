const fs = require('fs');
const p = 'src/routes/admin.tsx';
let s = fs.readFileSync(p, 'utf8');
const oldBlock = `                <div className="flex flex-wrap items-end gap-4">\n                  <div>\n                    <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#D4AF37]">Welcome back</p>\n                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#041E42] sm:text-[2.1rem]">{section.title}</h1>\n                  </div>\n                  <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/25 bg-[#FFF8E8] px-3 py-1.5 text-sm font-semibold text-[#A77E14]">\n                    <CalendarDays className="h-4 w-4" />\n                    {todayLabel}\n                  </div>\n                </div>\n                <p className="mt-4 max-w-2xl text-base leading-7 text-[#4B5563]">{section.subtitle}</p>`;

const newBlock = `                <div className="flex flex-wrap items-end gap-4">\n                  {isDashboard ? (\n                    <div>\n                      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#041E42] sm:text-[2.1rem]">{section.title}</h1>\n                    </div>\n                  ) : (\n                    <>\n                      <div>\n                        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#D4AF37]">Welcome back</p>\n                        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#041E42] sm:text-[2.1rem]">{section.title}</h1>\n                      </div>\n                      <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/25 bg-[#FFF8E8] px-3 py-1.5 text-sm font-semibold text-[#A77E14]">\n                        <CalendarDays className="h-4 w-4" />\n                        {todayLabel}\n                      </div>\n                    </>\n                  )}\n                </div>\n                {!isDashboard && <p className="mt-4 max-w-2xl text-base leading-7 text-[#4B5563]">{section.subtitle}</p>`;

if (s.indexOf(oldBlock) !== -1) {
  s = s.replace(oldBlock, newBlock);
  fs.writeFileSync(p, s);
  console.log('header patched');
} else {
  console.log('old block not found');
}

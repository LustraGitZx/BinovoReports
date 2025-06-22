if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}

function initialize(){
  const button = document.querySelector("body > div.fab-panel");
    if (button) setupReportButton(button);
    insertModalUI();
}

function setupReportButton(button) {
  const href = button.querySelector("a");
  href.removeAttribute("href");
  href.setAttribute("data-pt-title", "Отчеты");
  href.classList.remove("protip");
  href.innerHTML = "📄";

  button.addEventListener("click", () => {
    showDateModal();
  });
}

function getFormattedDate(date) {
  return date ? date.toLocaleDateString("ru-RU").split(".").join(".") : null;
}

function getBookingsUrl({ arrivalFrom, arrivalTo, departureFrom, departureTo, page = 1 }) {
  if (arrivalFrom) arrivalFrom = getFormattedDate(arrivalFrom);
  if (arrivalTo) arrivalTo = getFormattedDate(arrivalTo);
  if (departureFrom) departureFrom = getFormattedDate(departureFrom);
  if (departureTo) departureTo = getFormattedDate(departureTo);

  const params = new URLSearchParams({
    status_ids: "3,4,1,5",
    advanced_search: "2",
    c: "36",
    order_by: "create_date.desc",
    page,
  });

  if (arrivalFrom) params.append("arrival_from", arrivalFrom);
  if (arrivalTo) params.append("arrival_to", arrivalTo);
  if (departureFrom) params.append("departure_from", departureFrom);
  if (departureTo) params.append("departure_to", departureTo);

  return `https://online.bnovo.ru/dashboard?${params.toString()}`;
}

function fetchBookings(url) {
  return fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      "sec-ch-ua": '"Microsoft Edge";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
    },
    mode: "cors",
    referrer: "https://online.bnovo.ru/dashboard",
  }).then(res => res.json());
}

async function getBookings(params) {
  let page = 1, totalPages = 1;
  let bookings = [];

  while (page <= totalPages) {
    const url = getBookingsUrl({ ...params, page });
    try {
      const data = await fetchBookings(url);
      totalPages = data.pages.total_pages;
      bookings.push(...data.bookings);
    } catch (err) {
      console.error("❌ Ошибка загрузки:", err);
      break;
    }
    page++;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return bookings;
}

async function getAllBookings(reportDate) {
  const monthAgo = new Date(reportDate);
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  const monthForward = new Date(reportDate);
  monthForward.setMonth(monthForward.getMonth() + 1);

  const tomorrow = new Date(reportDate);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const yesterday = new Date(reportDate);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const living = await getBookings({
    arrivalFrom: monthAgo,
    arrivalTo: yesterday,
    departureFrom: tomorrow,
    departureTo: monthForward
  });

  console.log("Живут:", living);

  const arrivals = await getBookings({
    arrivalFrom: reportDate,
    arrivalTo: reportDate,
    departureFrom: null,
    departureTo: null
  });

  const departures = await getBookings({
    arrivalFrom: null,
    arrivalTo: null,
    departureFrom: reportDate,
    departureTo: reportDate
  });

  return [arrivals, departures, living];
}


function createTable(reportDate, arr, dep, liv) {
  const table = document.createElement("table");
  table.id = "reportTable";

  const thead = document.createElement("thead");

  const headerRow = document.createElement("tr");
  ["Номер комнаты", "Отъезд", "Заезд", "Живут", "Примечание"].forEach(text => {
    const th = document.createElement("th");
    th.textContent = text;
    headerRow.appendChild(th);
  });

  const tbody = document.createElement("tbody");
  thead.appendChild(headerRow);
  table.appendChild(thead);
  table.appendChild(tbody);

  

  const roomOrder = [
  "201","202","203","204","301","302","303","304","305","307",
  "312","313","314","315","316","317","306","308","309","310","311",
  "401","402","403","404","405","406","407","412","413","414","415",
  "416","417","418","420","408","409","410","411","419",
  "510","501","502","503","504","505","506","507","508","509",
  "511","512","513","514","515"];
  roomOrder.forEach(room => {
    const roomCell = document.createElement("td");
    roomCell.textContent = room;

    const depCell = document.createElement("td");
    depCell.textContent = "";
    if (dep.some(booking => booking.current_room === room))
      depCell.textContent = "Выезд";
    

    const arrCell = document.createElement("td");
    arrCell.textContent = "";
    let guest = arr.find(booking => booking.current_room === room);
    if (guest) {
      const adults = guest.extra.adults || 0;
      const children = guest.extra.children || 0;
      const bedVariant = guest.extra.bed_variant || 0;

      const parts = [];
      parts.push(`${adults + children} чел.`);
      parts.push(bedVariant === 1 ? "/1 кр." : bedVariant === 2 ? "/2 кр." : "");
      arrCell.textContent = parts.join(" ");
    }

    const noteCell = document.createElement("td");
    noteCell.textContent = "";
    const livCell = document.createElement("td");
    livCell.textContent = "";
    guest = liv.find(booking => booking.current_room == room);
    if (guest) {
      livCell.textContent = "Живут";

      const arrDate = new Date(guest.arrival);
      const depDate = new Date(guest.departure);
      arrDate.setHours(0, 0, 0, 0);
      depDate.setHours(0, 0, 0, 0);

      const stayLength = (depDate - arrDate) / (1000 * 60 * 60 * 24);
      if (stayLength >= 5){
        if (reportDate.getTime() != depDate.getTime()) {
            const dayIndex = (reportDate - arrDate) / (1000 * 60 * 60 * 24) + 1;
            if (dayIndex % 4 === 0) {
              noteCell.textContent = "Смена";
            }
      }
    }
  }

    const row = document.createElement("tr");
    row.appendChild(roomCell);
    row.appendChild(depCell);
    row.appendChild(arrCell);
    row.appendChild(livCell);
    row.appendChild(noteCell);

    tbody.appendChild(row);

  });

  return table
}

async function printReport(reportDate) {
  const bookings = await getAllBookings(reportDate);
  const table = createTable(reportDate, ...bookings);

  let printArea = document.getElementById("printArea");
  if (printArea) printArea.remove();
  printArea = document.createElement("div");
  printArea.id = "printArea";

  printArea.appendChild(table);

  const style = document.createElement("style");
  style.textContent = `
  #printArea { display: none; }
    @media print {
      #printArea { display: block; padding: 20px; }
      body *:not(#printArea):not(#printArea *) {
        display: none !important;
      }
      #printArea table {
        width: 100%;
        border-collapse: collapse;
        font-family: sans-serif;
        font-size: 14px;
      }
      #printArea th, #printArea td {
        border: 1px solid #000;
        padding: 0px;
        text-align: center;
      }
      #printArea th {
        background: #FFFFFF;
      }
    }`;

  printArea.appendChild(style);
  document.body.appendChild(printArea);
  closeDateModal();

    window.print();

  window.onafterprint = () => {
    const cleanup = document.getElementById("printArea");
    if (cleanup) cleanup.remove();
  };
}


function insertModalUI() {
  const modal = document.createElement("div");
  modal.id = "dateModal";
  modal.style.cssText = `
    display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%);
    background:white; border:1px solid #ccc; padding:20px; z-index:10000;
    box-shadow:0 0 10px rgba(0,0,0,0.3); font-family:sans-serif;
  `;

  const label = document.createElement("label");
  label.textContent = "Дата отчёта: ";
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.id = "selectedDate";
  label.appendChild(dateInput);

  const br = document.createElement("br");
  const br2 = document.createElement("br");

  const printBtn = document.createElement("button");
  printBtn.id = "printbtn";
  printBtn.textContent = "Печать";

  const closeBtn = document.createElement("button");
  closeBtn.id = "closebtn";
  closeBtn.textContent = "Отмена";

  modal.append(label, br, br2, printBtn, closeBtn);
  document.body.prepend(modal);

  printBtn.addEventListener("click", async () => {
    const selectedDate = new Date(document.getElementById("selectedDate").value);
    selectedDate.setHours(0, 0, 0, 0);
    if (selectedDate) {
      closeDateModal();
      await printReport(selectedDate);
    } else {
      alert("Пожалуйста, выберите дату.");
    }
  });

  closeBtn.addEventListener("click", closeDateModal);
}

function showDateModal() {
  document.getElementById('dateModal').style.display = 'block';
}
function closeDateModal() {
  document.getElementById('dateModal').style.display = 'none';
}

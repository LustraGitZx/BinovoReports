var arrivals = [];
var departures = [];
var living = [];


var REPORT_DATE = null;

const button = document.querySelector("body > div.fab-panel");
insertModalUI();
function getBookingsUrl(arrivalFrom, arrivalTo, departureFrom, departureTo, page = 1) {
    var baseUrl = `https://online.bnovo.ru/dashboard?status_ids=3,4,1,5&p=${page}`
    if (arrivalFrom != null)
        baseUrl += `&arrival_from=${arrivalFrom}`;
    if (arrivalTo != null)
        baseUrl += `&arrival_to=${arrivalTo}`;
    if (departureFrom != null)
        baseUrl += `&departure_from=${departureFrom}`;
    if (departureTo != null)
        baseUrl += `&departure_to=${departureTo}`;
    baseUrl += `&advanced_search=2&c=36&page=${page}&order_by=create_date.desc`;
    return baseUrl;
}

function requestBookings(url) {
    return fetch(url, {
            "headers": {
            "accept": "application/json",
            "sec-ch-ua": "\"Microsoft Edge\";v=\"137\", \"Chromium\";v=\"137\", \"Not/A)Brand\";v=\"24\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
        },
        "referrer": "https://online.bnovo.ru/dashboard?status_ids=3,4,1,5&arrival_from=20.05.2025&arrival_to=19.06.2025&departure_from=12.06.2025&departure_to=19.06.2025",
        "body": null,
        "method": "GET",
        "mode": "cors",
    })
}

function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Месяцы начинаются с 0
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

function processBookings(){
    // Обработка данных бронирований
    console.log("📦 Обработка бронирований...");
    console.log("Прибытия:", arrivals);
    console.log("Отправления:", departures);
    console.log("Проживающие:", living);

    renderPrintTable(arrivals, departures, living)

    arrivals = [];
    departures = [];
    living = [];
}

function getBookings(arrivalFrom, arrivalTo, departureFrom, departureTo, page = 1, nexthandler = null, afterhandler = null) {
    
    _arrivalFrom = arrivalFrom ? formatDate(arrivalFrom) : null;
    _arrivalTo = arrivalTo ? formatDate(arrivalTo) : null;
    _departureFrom = departureFrom ? formatDate(departureFrom) : null;
    _departureTo = departureTo ? formatDate(departureTo) : null;

    var url = getBookingsUrl(_arrivalFrom, _arrivalTo, _departureFrom, _departureTo, page);
    return requestBookings(url)
        .then(response => response.json())
        .then(data => {
            var bookings = data.bookings;
            nexthandler(bookings);
            pages = data.pages.total_pages;
            if (page < pages) {
                waiter = setTimeout(() => {
                    getBookings(arrivalFrom, arrivalTo, departureFrom, departureTo, page + 1, nexthandler, afterhandler);
                }, 2000); // Задержка для асинхронной обработки
            }
            else{
                if (afterhandler) {
                    afterhandler(bookings);
                }
            }
        });
}

function getArrivals(date) {
    getBookings(date, date, null, null, 1, (bookings) => {
        arrivals = arrivals.concat(bookings);
        console.log("📦 Прибытия получены:", arrivals);
    }, () => {
        getBookings(null, null, date, date, 1, (bookings) => {
            departures= departures.concat(bookings);
            console.log("📦 Отправления получены:", departures);
        }, () => {

            let monthAgo = new Date(date);
            monthAgo.setMonth(date.getMonth() - 1);

            let monthForward = new Date(date);
            monthForward.setMonth(date.getMonth() + 1);

            let tomorrow = new Date(date);
            tomorrow.setDate(date.getDate() + 1);

            let yesterday = new Date(date);
            yesterday.setDate(date.getDate() - 1);

            getBookings(monthAgo, yesterday, tomorrow, monthForward, 1, (bookings) => {
                living = living.concat(bookings);
                console.log("📦 Проживающие получены:", living);
            }, () => processBookings());
        });
    });
}


if (button) {
    href = button.querySelector('a');
    href.removeAttribute('href');
    href.setAttribute('data-pt-title', 'Отчеты');
    href.classList.remove('protip');
    href.innerHTML = '📄';

    button.addEventListener('click', function() {
        console.log("🔍 Получение отчета...");
        var tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        showDateModal();
    });
} else {
    console.error("❌ Старая кнопка не найдена, проверьте селектор!");
}
const roomOrder = [
  "201","202","203","204","301","302","303","304","305","307",
  "312","313","314","315","316","317","306","308","309","310","311",
  "401","402","403","404","405","406","407","412","413","414","415",
  "416","417","418","420","408","409","410","411","419",
  "510","501","502","503","504","505","506","507","508","509",
  "511","512","513","514","515"
];

function arrivalCell(room) {
  const guest = arrivals.find(b => b.current_room === room);
  if (!guest) return "";
  if (!guest.extra) return "?";

  const adults = guest.extra.adults || 0;
  const children = guest.extra.children || 0;
  const bedVariant = guest.extra.bed_variant;

  if (adults === 0 && children === 0) return "?";

  const parts = [];
  if (adults > 0) parts.push(`${adults} вз.`);
  if (children > 0) parts.push(`${children} дет.`);

  if (bedVariant === 1) {
    parts.push("/1 кр.");
  } else if (bedVariant === 2) {
    parts.push("/2 кр.");
  }

  return parts.join(" ");
}

function departureCell(room) {
  return departures.some(b => b.current_room === room) ? "➕" : "";
}

function livingCell(room) {
  return living.some(b => b.current_room === room) ? "➕" : "";
}

function noteCell(room) {
  const guest = living.find(b => b.current_room === room);
  if (!guest || !guest.arrival || !guest.departure) return "";

  const arrival = new Date(guest.arrival);
  const departure = new Date(guest.departure);
  const today = new Date();

  arrival.setHours(0, 0, 0, 0);
  departure.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const stayLength = (departure - arrival) / (1000 * 60 * 60 * 24);
  if (stayLength < 5) return "";

  const dayIndex = (today - arrival) / (1000 * 60 * 60 * 24) + 1;
  if (today.getTime() === departure.getTime()) return "";

  if (dayIndex > 0 && dayIndex % 4 === 0 && today < departure) {
    return "Смена";
  }

  return "";
}

function renderPrintTable(arrivals, departures, living) {
  const old = document.getElementById("printArea");
  if (old) old.remove();

  const printArea = document.createElement("div");
  printArea.id = "printArea";

  const styleTag = document.createElement("style");
  styleTag.textContent = `
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
        border: 1px solid #333;
        padding: 0px;
        text-align: center;
      }
      #printArea th {
        background: #f0f0f0;
      }
    }
  `;
  document.head.appendChild(styleTag);

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>Номер комнаты</th>
      <th>Отъезд</th>
      <th>Заезд</th>
      <th>Живут</th>
      <th>Примечание</th>
    </tr>`;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  roomOrder.forEach(room => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${room}</td>
      <td>${departureCell(room)}</td>
      <td>${arrivalCell(room)}</td>
      <td>${livingCell(room)}</td>
      <td>${noteCell(room)}</td>
    `;
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  printArea.appendChild(table);
  document.body.appendChild(printArea);

  window.print();

  window.onafterprint = () => {
    const cleanup = document.getElementById("printArea");
    if (cleanup) cleanup.remove();
  };
}


// Добавим модальное окно и кнопку через JS
function insertModalUI() {
  const modalHTML = `
    <div id="dateModal" style="
      display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%);
      background:white; border:1px solid #ccc; padding:20px; z-index:10000;
      box-shadow:0 0 10px rgba(0,0,0,0.3); font-family:sans-serif;">
      <label>Дата отчёта: <input type="date" id="selectedDate"></label>
      <br><br>
      <button id="printbtn">Печать</button>
      <button id="closebtn">Отмена</button>
    </div>
  `;
  const container = document.createElement("div");
  container.innerHTML = modalHTML;
  document.body.prepend(container);

  document.getElementById('printbtn').addEventListener('click', applySelectedDate);
  document.getElementById('closebtn').addEventListener('click', closeDateModal);
}

function showDateModal() {
  document.getElementById('dateModal').style.display = 'block';
}
function closeDateModal() {
  document.getElementById('dateModal').style.display = 'none';
}
function applySelectedDate() {
  const value = document.getElementById('selectedDate').value;
  if (value) {
    REPORT_DATE = new Date(value);
    closeDateModal();
    getArrivals(REPORT_DATE);
  }
}

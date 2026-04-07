const STORAGE_KEY = "expense-tracker-items";

const expenseForm = document.getElementById("expenseForm");
const expenseIdInput = document.getElementById("expenseId");
const titleInput = document.getElementById("title");
const amountInput = document.getElementById("amount");
const dateInput = document.getElementById("date");
const categoryInput = document.getElementById("category");
const paymentMethodInput = document.getElementById("paymentMethod");
const notesInput = document.getElementById("notes");
const submitButton = document.getElementById("submitButton");
const cancelEditButton = document.getElementById("cancelEditButton");
const expenseList = document.getElementById("expenseList");
const filterCategory = document.getElementById("filterCategory");
const searchInput = document.getElementById("searchInput");
const expenseItemTemplate = document.getElementById("expenseItemTemplate");

const totalSpentElement = document.getElementById("totalSpent");
const totalEntriesElement = document.getElementById("totalEntries");
const largestExpenseElement = document.getElementById("largestExpense");
const topCategoryElement = document.getElementById("topCategory");
const heroTotalElement = document.getElementById("heroTotal");
const heroEntriesElement = document.getElementById("heroEntries");
const heroCategoryElement = document.getElementById("heroCategory");
const categoryBarsElement = document.getElementById("categoryBars");
const chartHintElement = document.getElementById("chartHint");
const donutChartElement = document.getElementById("donutChart");
const donutTotalElement = document.getElementById("donutTotal");
const donutLegendElement = document.getElementById("donutLegend");
const trendChartElement = document.getElementById("trendChart");
const trendHintElement = document.getElementById("trendHint");

const CHART_COLORS = [
  "#7dc4ff",
  "#33d6a6",
  "#ffb957",
  "#ff7c70",
  "#b794ff",
  "#4de1ff",
  "#8ef5a8",
  "#ffd86b"
];

let expenses = loadExpenses();
let editingId = null;

initialize();

function initialize() {
  dateInput.value = getTodayInputValue();
  renderApp();

  expenseForm.addEventListener("submit", handleSubmit);
  cancelEditButton.addEventListener("click", resetForm);
  filterCategory.addEventListener("change", renderApp);
  searchInput.addEventListener("input", renderApp);
}

function handleSubmit(event) {
  event.preventDefault();

  const expense = {
    id: editingId ?? createExpenseId(),
    title: titleInput.value.trim(),
    amount: Number(amountInput.value),
    date: dateInput.value,
    category: categoryInput.value,
    paymentMethod: paymentMethodInput.value,
    notes: notesInput.value.trim()
  };

  if (!expense.title || !expense.date || Number.isNaN(expense.amount) || expense.amount <= 0) {
    return;
  }

  if (editingId) {
    expenses = expenses.map((item) => item.id === editingId ? expense : item);
  } else {
    expenses.unshift(expense);
  }

  persistExpenses();
  resetForm();
  renderApp();
}

function renderApp() {
  const visibleExpenses = getFilteredExpenses();
  renderExpenses(visibleExpenses);
  renderSummary();
  renderCategoryBars();
  renderDonutChart();
  renderTrendChart();
}

function renderExpenses(items) {
  expenseList.innerHTML = "";

  if (!items.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = expenses.length
      ? "No expenses match your current filters."
      : "Your expense list is empty. Add the first one to get started.";
    expenseList.appendChild(emptyState);
    return;
  }

  const fragment = document.createDocumentFragment();

  items
    .slice()
    .sort((a, b) => parseExpenseDate(b.date) - parseExpenseDate(a.date))
    .forEach((expense) => {
      const node = expenseItemTemplate.content.cloneNode(true);
      const item = node.querySelector(".expense-item");

      node.querySelector(".expense-title").textContent = expense.title;
      node.querySelector(".expense-amount").textContent = formatCurrency(expense.amount);
      node.querySelector(".expense-category").textContent = expense.category;
      node.querySelector(".expense-date").textContent = formatDate(expense.date);
      node.querySelector(".expense-payment").textContent = expense.paymentMethod;

      const notes = node.querySelector(".expense-notes");
      if (expense.notes) {
        notes.textContent = expense.notes;
      } else {
        notes.remove();
      }

      node.querySelector(".edit-button").addEventListener("click", () => startEdit(expense.id));
      node.querySelector(".delete-button").addEventListener("click", () => deleteExpense(expense.id));

      item.dataset.id = expense.id;
      fragment.appendChild(node);
    });

  expenseList.appendChild(fragment);
}

function renderSummary() {
  const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const largestExpense = expenses.reduce((largest, expense) => Math.max(largest, expense.amount), 0);
  const categoryTotals = getCategoryTotals();
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];

  totalSpentElement.textContent = formatCurrency(totalSpent);
  totalEntriesElement.textContent = String(expenses.length);
  largestExpenseElement.textContent = formatCurrency(largestExpense);
  topCategoryElement.textContent = topCategory ? topCategory[0] : "None";
  heroTotalElement.textContent = formatCurrency(getCurrentMonthTotal());
  heroEntriesElement.textContent = String(expenses.length);
  heroCategoryElement.textContent = topCategory ? topCategory[0] : "None";
}

function renderCategoryBars() {
  categoryBarsElement.innerHTML = "";
  const categoryTotals = getCategoryTotals();
  const entries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const grandTotal = entries.reduce((sum, [, total]) => sum + total, 0);

  if (!entries.length) {
    chartHintElement.textContent = "No expenses yet";
    return;
  }

  chartHintElement.textContent = `${entries.length} categor${entries.length === 1 ? "y" : "ies"} tracked`;

  const fragment = document.createDocumentFragment();

  entries.forEach(([category, total]) => {
    const percentage = grandTotal ? (total / grandTotal) * 100 : 0;
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <div class="bar-labels">
        <span>${category}</span>
        <span>${formatCurrency(total)} | ${percentage.toFixed(0)}%</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width: ${percentage}%;"></div>
      </div>
    `;
    fragment.appendChild(row);
  });

  categoryBarsElement.appendChild(fragment);
}

function renderDonutChart() {
  const categoryTotals = getCategoryTotals();
  const entries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, amount]) => sum + amount, 0);

  donutLegendElement.innerHTML = "";
  donutTotalElement.textContent = formatCurrency(total);

  if (!entries.length) {
    donutChartElement.style.background = `
      radial-gradient(circle at center, rgba(10, 19, 34, 0.98) 0 39%, transparent 40%),
      conic-gradient(from -90deg, rgba(255, 255, 255, 0.08) 0deg 360deg)
    `;

    const emptyLegend = document.createElement("div");
    emptyLegend.className = "empty-state";
    emptyLegend.textContent = "Add expenses to unlock the category chart.";
    donutLegendElement.appendChild(emptyLegend);
    return;
  }

  let startAngle = 0;
  const gradientStops = entries.map(([, amount], index) => {
    const sweep = (amount / total) * 360;
    const color = CHART_COLORS[index % CHART_COLORS.length];
    const stop = `${color} ${startAngle}deg ${startAngle + sweep}deg`;
    startAngle += sweep;
    return stop;
  });

  donutChartElement.style.background = `
    radial-gradient(circle at center, rgba(10, 19, 34, 0.98) 0 39%, transparent 40%),
    conic-gradient(from -90deg, ${gradientStops.join(", ")})
  `;

  const fragment = document.createDocumentFragment();

  entries.forEach(([category, amount], index) => {
    const percentage = total ? ((amount / total) * 100).toFixed(0) : 0;
    const item = document.createElement("div");
    item.className = "legend-item";
    item.innerHTML = `
      <span class="legend-swatch" style="background: ${CHART_COLORS[index % CHART_COLORS.length]};"></span>
      <span class="legend-label">${category}</span>
      <span class="legend-value">${percentage}%</span>
    `;
    fragment.appendChild(item);
  });

  donutLegendElement.appendChild(fragment);
}

function renderTrendChart() {
  const dailyTotals = getDailyTotals(7);
  const maxValue = dailyTotals.reduce((largest, item) => Math.max(largest, item.total), 0);

  trendChartElement.innerHTML = "";
  trendHintElement.textContent = "Last 7 days";

  if (!dailyTotals.some((item) => item.total > 0)) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = "Recent spending will appear here once you add dated expenses.";
    trendChartElement.appendChild(emptyState);
    return;
  }

  const fragment = document.createDocumentFragment();

  dailyTotals.forEach((item) => {
    const barCard = document.createElement("div");
    const height = maxValue ? Math.max((item.total / maxValue) * 100, item.total > 0 ? 8 : 0) : 0;
    barCard.className = "trend-bar-card";
    barCard.innerHTML = `
      <span class="trend-value">${item.total > 0 ? formatCompactCurrency(item.total) : "-"}</span>
      <div class="trend-bar-wrap">
        <div class="trend-bar" style="height: ${height}%;"></div>
      </div>
      <span class="trend-label">${item.label}</span>
    `;
    fragment.appendChild(barCard);
  });

  trendChartElement.appendChild(fragment);
}

function getFilteredExpenses() {
  const category = filterCategory.value;
  const searchTerm = searchInput.value.trim().toLowerCase();

  return expenses.filter((expense) => {
    const matchesCategory = category === "All" || expense.category === category;
    const haystack = [
      expense.title,
      expense.category,
      expense.paymentMethod,
      expense.notes
    ].join(" ").toLowerCase();
    const matchesSearch = !searchTerm || haystack.includes(searchTerm);
    return matchesCategory && matchesSearch;
  });
}

function getCategoryTotals() {
  return expenses.reduce((totals, expense) => {
    totals[expense.category] = (totals[expense.category] ?? 0) + expense.amount;
    return totals;
  }, {});
}

function getCurrentMonthTotal() {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  return expenses.reduce((sum, expense) => {
    const expenseDate = parseExpenseDate(expense.date);
    if (expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear) {
      return sum + expense.amount;
    }
    return sum;
  }, 0);
}

function getDailyTotals(days) {
  const totals = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let index = days - 1; index >= 0; index -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - index);

    const total = expenses.reduce((sum, expense) => {
      const expenseDate = parseExpenseDate(expense.date);
      if (isSameDay(expenseDate, day)) {
        return sum + expense.amount;
      }
      return sum;
    }, 0);

    totals.push({
      label: new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(day),
      total
    });
  }

  return totals;
}

function startEdit(id) {
  const expense = expenses.find((item) => item.id === id);
  if (!expense) {
    return;
  }

  editingId = id;
  expenseIdInput.value = id;
  titleInput.value = expense.title;
  amountInput.value = expense.amount;
  dateInput.value = expense.date;
  categoryInput.value = expense.category;
  paymentMethodInput.value = expense.paymentMethod;
  notesInput.value = expense.notes;
  submitButton.textContent = "Save changes";
  cancelEditButton.classList.remove("hidden");
  titleInput.focus();
}

function deleteExpense(id) {
  expenses = expenses.filter((expense) => expense.id !== id);
  persistExpenses();

  if (editingId === id) {
    resetForm();
  }

  renderApp();
}

function resetForm() {
  editingId = null;
  expenseIdInput.value = "";
  expenseForm.reset();
  dateInput.value = getTodayInputValue();
  submitButton.textContent = "Add expense";
  cancelEditButton.classList.add("hidden");
}

function persistExpenses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

function loadExpenses() {
  const storedExpenses = localStorage.getItem(STORAGE_KEY);
  if (!storedExpenses) {
    return [];
  }

  try {
    return JSON.parse(storedExpenses);
  } catch (error) {
    console.error("Unable to read saved expenses.", error);
    return [];
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(amount);
}

function formatCompactCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1
  }).format(amount);
}

function formatDate(dateString) {
  const date = parseExpenseDate(dateString);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function getTodayInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseExpenseDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isSameDay(firstDate, secondDate) {
  return firstDate.getFullYear() === secondDate.getFullYear()
    && firstDate.getMonth() === secondDate.getMonth()
    && firstDate.getDate() === secondDate.getDate();
}

function createExpenseId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `expense-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/***********************************
 * Global Data in localStorage
 ***********************************/
let clients = [];
let upsells = [];
let successPacks = [];
let renews = [];
let targets = {};
let settings = {}; 
let conversionRates = {}; // Cache for conversion rates (1 day)

// Indices for editing
let currentUpsellEditIndex = -1;
let currentSuccessPackEditIndex = -1;
let currentRenewEditIndex = -1; // For editing from the Renew List
let currentRenewClientIndex = -1; // For "Renew Client" from the Clients tab

/***********************************
 * Helper: Get SF Local Date String
 ***********************************/
function getSFLocalDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${year}-${month}-${day}`;
}

/***********************************
 * Helper: Conversion Rates (cache 1 day)
 ***********************************/
function getConversionRates(callback) {
  const storedRates = localStorage.getItem('conversionRates');
  const storedTimestamp = localStorage.getItem('conversionRatesTimestamp');
  const now = Date.now();
  if (storedRates && storedTimestamp && (now - parseInt(storedTimestamp, 10)) < 24 * 60 * 60 * 1000) {
    conversionRates = JSON.parse(storedRates);
    console.log("Using cached conversion rates");
    if (callback) callback();
  } else {
    fetchConversionRates(callback, false);
  }
}

function fetchConversionRates(callback, isAutomatic = false) {
  $.getJSON("https://cdn.taux.live/api/latest.json")
    .done(function(data) {
      conversionRates = data.rates;
      localStorage.setItem('conversionRates', JSON.stringify(conversionRates));
      localStorage.setItem('conversionRatesTimestamp', Date.now().toString());
      console.log("New conversion rates loaded:", conversionRates);
      
      // Afficher une notification
      Toastify({
        text: isAutomatic ? "Taux de change mis à jour automatiquement" : "Taux de change mis à jour",
        duration: 3000,
        gravity: "top",
        position: "right",
        backgroundColor: "#4caf50"
      }).showToast();
      
      if (callback) callback();
    })
    .fail(function() {
      Toastify({
        text: "Échec de la mise à jour des taux de change",
        duration: 3000,
        gravity: "top",
        position: "right",
        backgroundColor: "#f44336"
      }).showToast();
      if (callback) callback();
    });
}

/***********************************
 * Helper: Convert Amount
 ***********************************/
function convertAmount(amount, currency, callback) {
  if (!currency || currency === "USD") {
    callback(amount, 1);
  } else {
    if (Object.keys(conversionRates).length === 0) {
      getConversionRates(function() {
        const rate = conversionRates[currency];
        if (rate && rate !== 0) {
          callback(amount / rate, rate);
        } else {
          console.warn(`No valid rate for currency: ${currency}`);
          callback(amount, 1);
        }
      });
    } else {
      const rate = conversionRates[currency];
      if (rate && rate !== 0) {
        callback(amount / rate, rate);
      } else {
        console.warn(`No valid rate for currency: ${currency}`);
        callback(amount, 1);
      }
    }
  }
}

/***********************************
 * Helper: Calculate Added to Target
 ***********************************/
function calculateAddedToTarget(amount, frequency) {
  let addedToTarget = 0;
  if (frequency === "Monthly") {
    addedToTarget = amount * 0.80;
  } else if (frequency === "Yearly (1)") {
    addedToTarget = amount;
  } else if (frequency === "Yearly (2)") {
    addedToTarget = (amount * 1.10) / 2;
  } else if (frequency === "Yearly (3)") {
    addedToTarget = (amount * 1.25) / 3;
  } else if (frequency === "Yearly (4)") {
    addedToTarget = (amount * 1.35) / 4;
  } else if (frequency === "Yearly (5)") {
    addedToTarget = (amount * 1.40) / 5;
  } else {
    addedToTarget = amount;
  }
  return addedToTarget;
}

/***********************************
 * Document Ready
 ***********************************/
$(document).ready(function() {
  getConversionRates(function() {
    loadData();
    loadSettings();
    populateMonthSelect();
    updateTargetInputs();
    
    // Démarrer le système d'export automatique périodique seulement si activé
    if (settings.enableAutoExport !== false) { // Activé par défaut
      setupAutomaticExport();
    }
    
    // Démarrer le système de rafraîchissement automatique des taux de change
    setupAutomaticRatesRefresh();

    $('.nav-link').click(function(e) {
      e.preventDefault();
      const tab = $(this).data('tab');
      $('.nav-link').removeClass('active');
      $(this).addClass('active');
      $('.tab-content').removeClass('active').hide();
      $('#' + tab).addClass('active').show();
      if (tab === 'dashboard') {
        updateDashboard();
      }
    });

    $('#resetDataBtn').click(function() {
      if (confirm("Are you sure you want to reset all data?")) {
        localStorage.clear();
        location.reload();
      }
    });

    $('#addClientBtn').click(function() {
      openClientModal(null);
      $("#clientModal").modal("show");
    });

    $('.closeModal').click(function() {
      $("#clientModal").modal("hide");
      $("#renewModal").modal("hide");
      $("#renewEditModal").modal("hide");
      $("#targetAdjustModal").modal("hide");
      $("#upsellModal").modal("hide");
      $("#upsellEditModal").modal("hide");
    });

    $('#clientForm').submit(function(e) {
      e.preventDefault();
      saveClient();
      $("#clientModal").modal("hide");
    });

    $('#importBtn').click(function() {
      const fileInput = document.getElementById('importFile');
      if (!fileInput || fileInput.files.length === 0) {
        Toastify({
          text: "Please choose a file first.",
          duration: 3000,
          gravity: "top",
          position: "right",
          backgroundColor: "#f44336"
        }).showToast();
        return;
      }
      handleFile(fileInput.files[0]);
    });

    $('#targetForm').submit(function(e) {
      e.preventDefault();
      saveTarget();
    });

    $('#addUpsellBtn').click(function() {
      openUpsellModal();
    });

    $('#upsellForm').submit(function(e) {
      e.preventDefault();
      saveUpsell();
    });

    $('#upsellEditForm').submit(function(e) {
      e.preventDefault();
      updateUpsell();
    });

    $('#addSuccessPackBtn').click(function() {
      if (currentSuccessPackEditIndex === -1) addSuccessPack();
      else updateSuccessPack();
    });

    $('#renewClientForm').submit(function(e) {
      e.preventDefault();
      saveRenewClient();
    });

    $('#renewEditForm').submit(function(e) {
      e.preventDefault();
      handleUpdateRenew();
      $("#renewEditModal").modal("hide");
    });

    $('#adjustTargetBtn').click(function() {
      $("#targetAdjustModal").modal("show");
    });

    $('#targetAdjustForm').submit(function(e) {
      e.preventDefault();
      let adjustDate = $('#adjustDate').val();
      let adjustAmount = parseFloat($('#adjustAmount').val()) || 0;
      let adjustDescription = $('#adjustDescription').val().trim();
      if (!adjustDate || adjustDescription === "") {
        Toastify({
          text: "Veuillez remplir tous les champs",
          duration: 3000,
          gravity: "top",
          position: "right",
          backgroundColor: "#f44336"
        }).showToast();
        return;
      }
      let adjustmentRecord = {
        clientName: "🔧 " + adjustDescription,
        description: adjustDescription,
        amount: 0,
        currency: "USD",
        frequency: "",
        users: 0,
        date: adjustDate,
        nextRenewalDate: adjustDate,
        convertedAmount: 0,
        addedToTarget: adjustAmount,
        isAdjustment: true
      };
      renews.push(adjustmentRecord);
      saveData();
      renderRenewTable();
      updateDashboard();
      $("#targetAdjustModal").modal("hide");
      Toastify({
        text: "Target adjustment saved",
        duration: 3000,
        gravity: "top",
        position: "right",
        backgroundColor: "#4caf50"
      }).showToast();
    });

    initClientAutocompletes();
    populateCurrencySelect('#upsellCurrency');
    populateCurrencySelect('#successPackCurrency');
    populateCurrencySelect('#renewCurrency');
    populateCurrencySelect('#renewModalCurrency');
    populateCurrencySelect('#editRenewCurrency');
    populateCurrencySelect('#editUpsellCurrency');

    refreshClientSelects();
    renderClientTable();
    renderUpsellTable();
    renderSuccessPackTable();
    renderRenewTable();
    updateDashboard();
  });

  /***********************************
   * Export JSON
   ***********************************/
  $('#exportJsonBtn').click(function() {
    // Export manuel - utilise le nom de fichier avec la date
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    exportDataToJson(`odoo-cstd-export-manual-${dateStr}.json`, false);
  });
  
  // Événement pour l'activation/désactivation de l'export automatique
  $('#enableAutoExport').change(function() {
    const isEnabled = $(this).is(':checked');
    settings.enableAutoExport = isEnabled;
    saveSettings();
    
    // Si activé et pas déjà en cours, démarrer l'export automatique
    if (isEnabled && !window.autoExportActive) {
      setupAutomaticExport();
      Toastify({
        text: "Automatic export enabled",
        duration: 3000,
        gravity: "top",
        position: "right",
        backgroundColor: "#4caf50"
      }).showToast();
    } else if (!isEnabled) {
      window.autoExportActive = false;
      Toastify({
        text: "Automatic export disabled",
        duration: 3000,
        gravity: "top",
        position: "right",
        backgroundColor: "#ff9800"
      }).showToast();
    }
  });

});

/***********************************
 * Load / Save / Settings
 ***********************************/
function loadData() {
  const sc = localStorage.getItem('clients');
  if (sc) clients = JSON.parse(sc);
  const su = localStorage.getItem('upsells');
  if (su) upsells = JSON.parse(su);
  const ss = localStorage.getItem('successPacks');
  if (ss) successPacks = JSON.parse(ss);
  const sr = localStorage.getItem('renews');
  if (sr) renews = JSON.parse(sr);
  const st = localStorage.getItem('targets');
  if (st) targets = JSON.parse(st);
  // Ajouter les champs forecast si absents
  Object.keys(targets).forEach(m => {
    if (!targets[m].recurringForecast) targets[m].recurringForecast = 0;
    if (!targets[m].nonRecurringForecast) targets[m].nonRecurringForecast = 0;
  });
}

function saveData() {
  localStorage.setItem('clients', JSON.stringify(clients));
  localStorage.setItem('upsells', JSON.stringify(upsells));
  localStorage.setItem('successPacks', JSON.stringify(successPacks));
  localStorage.setItem('renews', JSON.stringify(renews));
  localStorage.setItem('targets', JSON.stringify(targets));
}

function loadSettings() {
  const s = localStorage.getItem('settings');
  if (!s) {
    // Paramètres par défaut
    settings = {
      enableAutoExport: true // Activé par défaut
    };
  } else {
    settings = JSON.parse(s);
  }
  
  // Mettre à jour l'état de la case à cocher
  if ($('#enableAutoExport').length) {
    $('#enableAutoExport').prop('checked', settings.enableAutoExport !== false);
  }
}

function saveSettings() {
  localStorage.setItem('settings', JSON.stringify(settings));
}

/***********************************
 * Tools: Date => "YYYY-MM"
 ***********************************/
function getMonthKey(dateString) {
  if (!dateString) return "N/A";
  let d = new Date(dateString);
  if (isNaN(d.getTime())) return "N/A";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`;
}

function formatMonthLabel(yyyyMM) {
  if (!yyyyMM.includes("-")) return yyyyMM;
  let [y, m] = yyyyMM.split("-");
  let d = new Date(+y, +m - 1, 1);
  return d.toLocaleString('default', { month: 'long', year: 'numeric' });
}

function initClientAutocompletes() {
  const arr = clients.map((c, i) => ({ label: c.clientName, value: i }));
  $("#upsellClientInput").autocomplete({
    source: arr,
    select: function(evt, ui) {
      $("#upsellClientInput").val(ui.item.label);
      $("#upsellClientIndex").val(ui.item.value);
      return false;
    }
  });
  $("#editUpsellClientInput").autocomplete({
    source: arr,
    select: function(evt, ui) {
      $("#editUpsellClientInput").val(ui.item.label);
      $("#editUpsellClientIndex").val(ui.item.value);
      return false;
    }
  });
  $("#successPackClientInput").autocomplete({
    source: arr,
    select: function(evt, ui) {
      $("#successPackClientInput").val(ui.item.label);
      $("#successPackClientIndex").val(ui.item.value);
      return false;
    }
  });
}

function populateCurrencySelect(sel) {
  const currencies = [
    "USD","EUR","GBP","CAD","AUD","JPY","CNY","BRL","MXN","INR",
    "ZAR","CHF","SGD","HKD","SEK","DKK","NOK","NZD","RUB","KRW",
    "ARS","BOB","CLP","COP","CRC","CUP","DOP","GTQ","HNL","HTG",
    "NIO","PAB","PEN","PYG","UYU","VES","BBD","BSD","BZD","XCD",
    "GYD","JMD","TTD"
  ];
  let select = $(sel);
  select.empty();
  currencies.forEach(c => {
    select.append(`<option value="${c}">${c}</option>`);
  });
}

function refreshClientSelects() {
  initClientAutocompletes();
}

/***********************************
 * Clients
 ***********************************/
function openClientModal(index) {
  if (index === null) {
    $('#clientModalTitle').text('Add New Client');
    $('#clientForm')[0].reset();
    $('#saveClientBtn').data('index', -1);
  } else {
    $('#clientModalTitle').text('Edit Client');
    const c = clients[index];
    $('#clientName').val(c.clientName);
    $('#plan').val(c.plan);
    $('#hosting').val(c.hosting);
    $('#amount').val(c.amount);
    $('#frequency').val(c.frequency);
    $('#users').val(c.users);
    $('#currency').val(c.currency);
    $('#nextRenewalDate').val(c.nextRenewalDate);
    $('#status').val(c.status);
    $('#odooLink').val(c.odooLink);
    $('#saveClientBtn').data('index', index);
  }
}

function saveClient() {
  const i = $('#saveClientBtn').data('index');
  const obj = {
    clientName: $('#clientName').val().trim(),
    plan: $('#plan').val(),
    hosting: $('#hosting').val(),
    amount: parseFloat($('#amount').val()) || 0,
    frequency: $('#frequency').val(),
    users: parseInt($('#users').val()) || 0,
    currency: $('#currency').val(),
    nextRenewalDate: $('#nextRenewalDate').val(),
    status: $('#status').val(),
    odooLink: $('#odooLink').val().trim()
  };
  convertAmount(obj.amount, obj.currency, function(converted, rate) {
    obj.convertedAmount = converted;
    obj.conversionRate = rate;
    if (i === -1) clients.push(obj);
    else clients[i] = obj;
    saveData();
    renderClientTable();
    refreshClientSelects();
    updateDashboard();
  });
}

function renderClientTable() {
  const container = $('#clientTableBody');
  container.empty();
  let sorted = clients.slice().sort((a, b) => {
    let da = a.nextRenewalDate ? new Date(a.nextRenewalDate) : new Date(9999, 0, 1);
    let db = b.nextRenewalDate ? new Date(b.nextRenewalDate) : new Date(9999, 0, 1);
    return da - db;
  });
  let groups = {};
  sorted.forEach(cli => {
    let key = "No Renewal Date";
    if (cli.nextRenewalDate) {
      let d = new Date(cli.nextRenewalDate);
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    if (!groups[key]) groups[key] = [];
    groups[key].push(cli);
  });
  let keys = Object.keys(groups).filter(k => k !== "No Renewal Date").sort();
  if (groups["No Renewal Date"]) keys.push("No Renewal Date");
  let accordion = $('<div id="clientAccordion"></div>');
  let currentMonthKey = getMonthKey(getSFLocalDateString());
  keys.forEach((key, idx) => {
    let isCurrent = key === currentMonthKey;
    let dateLabel = (key === "No Renewal Date") ? "No Renewal Date" : formatMonthLabel(key);
    let headingId = `heading-${key}`;
    let collapseId = `collapse-${key}`;
    let card = $(`
      <div class="card">
        <div class="card-header" id="${headingId}">
          <h5 class="mb-0">
            <button class="btn btn-link" data-toggle="collapse" data-target="#${collapseId}"
              aria-expanded="${isCurrent ? 'true' : 'false'}" aria-controls="${collapseId}">
              ${dateLabel}
            </button>
          </h5>
        </div>
        <div id="${collapseId}" class="collapse ${isCurrent ? 'show' : ''}">
          <div class="card-body">
            <table class="table table-striped mb-0">
              <thead>
                <tr>
                  <th>Renew</th>
                  <th>Client</th>
                  <th>Plan</th>
                  <th>Hosting</th>
                  <th>Original Amount</th>
                  <th>Converted Amount</th>
                  <th>Frequency</th>
                  <th>Users</th>
                  <th>Next Renewal</th>
                  <th>Status</th>
                  <th>Odoo Link</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody class="group-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `);
    let groupTbody = card.find('.group-tbody');
    groups[key].forEach(cli => {
      let tr = $('<tr></tr>');
      let tdRenew = $('<td></td>');
      let renewBtn = $('<button class="btn btn-sm btn-success" title="Renew">♻️</button>');
      renewBtn.click(function() {
        let idxCli = clients.indexOf(cli);
        if (idxCli !== -1) openRenewModal(idxCli);
      });
      tdRenew.append(renewBtn);
      tr.append(tdRenew);
      tr.append(`<td>${cli.clientName}</td>`);
      tr.append(`<td>${cli.plan}</td>`);
      tr.append(`<td>${cli.hosting}</td>`);
      let originalCell = `${cli.amount} ${cli.currency}`;
      tr.append(`<td>${originalCell}</td>`);
      let convertedCell = cli.convertedAmount
        ? `${cli.convertedAmount.toFixed(2)} USD`
        : `${cli.amount} USD`;
      tr.append(`<td>${convertedCell}</td>`);
      tr.append(`<td>${cli.frequency}</td>`);
      tr.append(`<td>${cli.users}</td>`);
      tr.append(`<td>${cli.nextRenewalDate || ''}</td>`);
      tr.append(`<td>${cli.status || ''}</td>`);
      let linkHtml = cli.odooLink ? `<a href="${cli.odooLink}" target="_blank">Link</a>` : '';
      tr.append(`<td>${linkHtml}</td>`);
      let tdActions = $('<td></td>');
      let editBtn = $('<button class="btn btn-sm btn-warning mr-1" title="Edit">✏️</button>');
      editBtn.click(function() {
        let idxCli = clients.indexOf(cli);
        if (idxCli !== -1) {
          openClientModal(idxCli);
          $("#clientModal").modal("show");
        }
      });
      let delBtn = $('<button class="btn btn-sm btn-danger" title="Delete">🗑️</button>');
      delBtn.click(function() {
        let idxCli = clients.indexOf(cli);
        if (idxCli !== -1 && confirm("Are you sure?")) {
          clients.splice(idxCli, 1);
          saveData();
          renderClientTable();
          refreshClientSelects();
          updateDashboard();
          Toastify({
            text: "Client deleted",
            duration: 3000,
            gravity: "top",
            position: "right",
            backgroundColor: "#4caf50"
          }).showToast();
        }
      });
      tdActions.append(editBtn, delBtn);
      tr.append(tdActions);
      groupTbody.append(tr);
    });
    accordion.append(card);
  });
  container.append(accordion);
}

/***********************************
 * Renew from Clients side (modal #renewModal)
 ***********************************/
function openRenewModal(idx) {
  currentRenewClientIndex = idx;
  const cli = clients[idx];
  $('#renewModalPlan').val(cli.plan);
  $('#renewModalHosting').val(cli.hosting);
  $('#renewModalAmount').val(cli.amount);
  $('#renewModalFrequency').val(cli.frequency);
  $('#renewModalUsers').val(cli.users);
  $('#renewModalCurrency').val(cli.currency);
  $('#renewModal').modal("show");
}

function saveRenewClient() {
  if (currentRenewClientIndex === -1) return;
  const cli = clients[currentRenewClientIndex];

  const newPlan = $('#renewModalPlan').val();
  const newHosting = $('#renewModalHosting').val();
  const newAmt = parseFloat($('#renewModalAmount').val()) || 0;
  const newFreq = $('#renewModalFrequency').val();
  const newUsers = parseInt($('#renewModalUsers').val()) || 0;
  const newCur = $('#renewModalCurrency').val() || "USD";

  cli.plan = newPlan;
  cli.hosting = newHosting;
  cli.amount = newAmt;
  cli.frequency = newFreq;
  cli.users = newUsers;
  cli.currency = newCur;

  let oldDate = cli.nextRenewalDate ? new Date(cli.nextRenewalDate) : new Date();
  let newDate = new Date(oldDate);
  if (newFreq.toLowerCase().includes("month")) {
    newDate.setMonth(newDate.getMonth() + 1);
  } else {
    let match = newFreq.match(/\((\d+)\)/);
    let nbYears = match ? parseInt(match[1], 10) : 1;
    newDate.setFullYear(newDate.getFullYear() + nbYears);
  }
  const nextRenewalDate = getSFLocalDateString(newDate);
  cli.nextRenewalDate = nextRenewalDate;

  convertAmount(newAmt, newCur, function(converted, rate) {
    cli.convertedAmount = converted;
    cli.conversionRate = rate;

    let addedToTarget = calculateAddedToTarget(converted, newFreq);

    let renewRecord = {
      clientName: cli.clientName,
      plan: newPlan,
      hosting: newHosting,
      amount: newAmt,
      currency: newCur,
      frequency: newFreq,
      users: newUsers,
      date: getSFLocalDateString(),
      nextRenewalDate: nextRenewalDate
    };
    renewRecord.convertedAmount = converted;
    renewRecord.conversionRate = rate;
    renewRecord.addedToTarget = addedToTarget;

    renews.push(renewRecord);
    saveData();
    renderClientTable();
    renderRenewTable();
    updateDashboard();
    $("#renewModal").modal("hide");
    Toastify({
      text: "Client renewed & record updated",
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: "#4caf50"
    }).showToast();
    currentRenewClientIndex = -1;
  });
}

/***********************************
 * Renew tab: table + editing via #renewEditModal
 ***********************************/
function renderRenewTable() {
  const tbody = $("#renewTableBody");
  tbody.empty();
  let sorted = renews.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  sorted.forEach((rn) => {
    let cname = rn.clientName || "Unknown";
    let originalCell = `${rn.amount} ${rn.currency}`;
    let convertedCell = rn.convertedAmount
      ? `${rn.convertedAmount.toFixed(2)} USD`
      : `${rn.amount} USD`;
    let tr = $(`
      <tr>
        <td>${cname}</td>
        <td>${rn.plan}</td>
        <td>${rn.hosting}</td>
        <td>${originalCell}</td>
        <td>${convertedCell}</td>
        <td>${(rn.addedToTarget !== undefined) ? rn.addedToTarget.toFixed(2) + " USD" : "N/A"}</td>
        <td>${rn.frequency}</td>
        <td>${rn.users}</td>
        <td>${rn.date}</td>
        <td>
          <button class="btn btn-sm btn-warning mr-1" title="Edit">✏️</button>
          <button class="btn btn-sm btn-danger" title="Delete">🗑️</button>
        </td>
      </tr>
    `);
    let originalIndex = renews.indexOf(rn);
    tr.find('.btn-warning').click(() => openRenewEditModal(originalIndex));
    tr.find('.btn-danger').click(() => deleteRenew(originalIndex));
    tbody.append(tr);
  });
}

function openRenewEditModal(i) {
  currentRenewEditIndex = i;
  const r = renews[i];
  $('#editRenewPlan').val(r.plan);
  $('#editRenewHosting').val(r.hosting);
  $('#editRenewAmount').val(r.amount);
  $('#editRenewCurrency').val(r.currency);
  $('#editRenewFrequency').val(r.frequency);
  $('#editRenewUsers').val(r.users);
  $('#editRenewDate').val(r.date);
  $('#editRenewAddedToTarget').val(r.addedToTarget !== undefined ? r.addedToTarget : "");
  $('#renewEditModal').modal('show');
}

function handleUpdateRenew() {
  if (currentRenewEditIndex === -1) return;
  const r = renews[currentRenewEditIndex];
  r.plan = $('#editRenewPlan').val();
  r.hosting = $('#editRenewHosting').val();
  r.amount = parseFloat($('#editRenewAmount').val()) || 0;
  r.currency = $('#editRenewCurrency').val() || "USD";
  r.frequency = $('#editRenewFrequency').val();
  r.users = parseInt($('#editRenewUsers').val()) || 0;
  r.date = $('#editRenewDate').val() || getSFLocalDateString();
  r.addedToTarget = parseFloat($('#editRenewAddedToTarget').val()) || r.addedToTarget;
  convertAmount(r.amount, r.currency, function(converted, rate) {
    r.convertedAmount = converted;
    r.conversionRate = rate;
    saveData();
    renderRenewTable();
    updateDashboard();
    currentRenewEditIndex = -1;
    Toastify({
      text: "Renew updated.",
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: "#4caf50"
    }).showToast();
  });
}

function deleteRenew(i) {
  if (confirm("Are you sure?")) {
    renews.splice(i, 1);
    saveData();
    renderRenewTable();
    updateDashboard();
    Toastify({
      text: "Renew deleted",
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: "#4caf50"
    }).showToast();
  }
}

/***********************************
 * Upsells
 ***********************************/
function openUpsellModal() {
  $('#upsellModalTitle').text('Add New Upsell');
  $('#upsellForm')[0].reset();
  $("#upsellModal").modal("show");
}

function saveUpsell() {
  const idx = $("#upsellClientIndex").val();
  if (!idx) {
    Toastify({
      text: "Please select a valid client",
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: "#f44336"
    }).showToast();
    return;
  }
  const desc = $("#upsellDescription").val().trim();
  const amt = parseFloat($("#upsellAmount").val()) || 0;
  const ccy = $("#upsellCurrency").val();
  const freq = $("#upsellFrequency").val();
  const dt = $("#upsellDate").val() || getSFLocalDateString();
  convertAmount(amt, ccy, function(converted, rate) {
    const addedToTarget = calculateAddedToTarget(converted, freq);
    upsells.push({
      clientIndex: parseInt(idx, 10),
      description: desc,
      amount: amt,
      currency: ccy,
      frequency: freq,
      convertedAmount: converted,
      conversionRate: rate,
      addedToTarget: addedToTarget,
      date: dt
    });
    saveData();
    renderUpsellTable();
    $("#upsellModal").modal("hide");
    Toastify({
      text: "Upsell added",
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: "#4caf50"
    }).showToast();
    updateDashboard();
  });
}

function openUpsellEditModal(index) {
  const up = upsells[index];
  $('#editUpsellClientInput').val(clients[up.clientIndex] ? clients[up.clientIndex].clientName : "");
  $('#editUpsellClientIndex').val(up.clientIndex);
  $('#editUpsellDescription').val(up.description);
  $('#editUpsellAmount').val(up.amount);
  $('#editUpsellCurrency').val(up.currency);
  $('#editUpsellFrequency').val(up.frequency);
  $('#editUpsellDate').val(up.date);
  $('#editUpsellAddedToTarget').val(up.addedToTarget);
  currentUpsellEditIndex = index;
  $("#upsellEditModal").modal("show");
}

function updateUpsell() {
  if (currentUpsellEditIndex === -1) return;
  const idx = $("#editUpsellClientIndex").val();
  if (!idx) {
    Toastify({
      text: "Please select a valid client",
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: "#f44336"
    }).showToast();
    return;
  }
  const desc = $("#editUpsellDescription").val().trim();
  const amt = parseFloat($("#editUpsellAmount").val()) || 0;
  const ccy = $("#editUpsellCurrency").val();
  const freq = $("#editUpsellFrequency").val();
  const dt = $("#editUpsellDate").val() || getSFLocalDateString();
  const addedToTarget = parseFloat($("#editUpsellAddedToTarget").val()) || 0;
  convertAmount(amt, ccy, function(converted, rate) {
    upsells[currentUpsellEditIndex] = {
      clientIndex: parseInt(idx, 10),
      description: desc,
      amount: amt,
      currency: ccy,
      frequency: freq,
      convertedAmount: converted,
      conversionRate: rate,
      addedToTarget: addedToTarget,
      date: dt
    };
    saveData();
    renderUpsellTable();
    $("#upsellEditModal").modal("hide");
    currentUpsellEditIndex = -1;
    Toastify({
      text: "Upsell updated",
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: "#4caf50"
    }).showToast();
    updateDashboard();
  });
}

function deleteUpsell(i) {
  if (confirm("Are you sure?")) {
    upsells.splice(i, 1);
    saveData();
    renderUpsellTable();
    Toastify({
      text: "Upsell deleted",
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: "#4caf50"
    }).showToast();
    updateDashboard();
  }
}

function renderUpsellTable() {
  const tbody = $("#upsellTableBody");
  tbody.empty();
  let sorted = upsells.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  sorted.forEach((up) => {
    let originalIndex = upsells.indexOf(up);
    const cname = (clients[up.clientIndex]) ? clients[up.clientIndex].clientName : "Unknown";
    let originalCell = `${up.amount} ${up.currency}`;
    let convertedCell = up.convertedAmount ? `${up.convertedAmount.toFixed(2)} USD` : `${up.amount} USD`;
    let addedToTargetCell = up.addedToTarget ? `${up.addedToTarget.toFixed(2)} USD` : "N/A";
    let tr = $(`
      <tr>
        <td>${cname}</td>
        <td>${up.description}</td>
        <td>${originalCell}</td>
        <td>${convertedCell}</td>
        <td>${addedToTargetCell}</td>
        <td>${up.frequency}</td>
        <td>${up.date}</td>
        <td>
          <button class="btn btn-sm btn-warning mr-1" title="Edit">✏️</button>
          <button class="btn btn-sm btn-danger" title="Delete">🗑️</button>
        </td>
      </tr>
    `);
    tr.find('.btn-warning').click(() => openUpsellEditModal(originalIndex));
    tr.find('.btn-danger').click(() => deleteUpsell(originalIndex));
    tbody.append(tr);
  });
}

/***********************************
 * Success Packs
 ***********************************/
function addSuccessPack() {
  const idx = $("#successPackClientIndex").val();
  if (!idx) {
    Toastify({
      text: "Please select a valid client",
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: "#f44336"
    }).showToast();
    return;
  }
  const desc = $("#successPackDescription").val().trim();
  const amt = parseFloat($("#successPackAmount").val()) || 0;
  const ccy = $("#successPackCurrency").val();
  const dt = $("#successPackDate").val() || getSFLocalDateString();
  convertAmount(amt, ccy, function(converted, rate) {
    successPacks.push({
      clientIndex: parseInt(idx, 10),
      description: desc,
      amount: amt,
      currency: ccy,
      convertedAmount: converted,
      conversionRate: rate,
      date: dt
    });
    saveData();
    renderSuccessPackTable();
    $("#successPackDescription").val("");
    $("#successPackAmount").val("");
    $("#successPackClientInput").val("");
    $("#successPackClientIndex").val("");
    $("#successPackDate").val("");
    currentSuccessPackEditIndex = -1;
    $("#addSuccessPackBtn").text("Add Success Pack");
    Toastify({
      text: "Success Pack added",
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: "#4caf50"
    }).showToast();
    updateDashboard();
  });
}

function updateSuccessPack() {
  if (currentSuccessPackEditIndex === -1) return;
  const idx = $("#successPackClientIndex").val();
  if (!idx) {
    Toastify({
      text: "Please select a valid client",
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: "#f44336"
    }).showToast();
    return;
  }
  const desc = $("#successPackDescription").val().trim();
  const amt = parseFloat($("#successPackAmount").val()) || 0;
  const ccy = $("#successPackCurrency").val();
  const dt = $("#successPackDate").val() || getSFLocalDateString();
  convertAmount(amt, ccy, function(converted, rate) {
    successPacks[currentSuccessPackEditIndex] = {
      clientIndex: parseInt(idx, 10),
      description: desc,
      amount: amt,
      currency: ccy,
      convertedAmount: converted,
      conversionRate: rate,
      date: dt
    };
    saveData();
    renderSuccessPackTable();
    $("#successPackDescription").val("");
    $("#successPackAmount").val("");
    $("#successPackClientInput").val("");
    $("#successPackClientIndex").val("");
    $("#successPackDate").val("");
    currentSuccessPackEditIndex = -1;
    $("#addSuccessPackBtn").text("Add Success Pack");
    Toastify({
      text: "Success Pack updated",
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: "#4caf50"
    }).showToast();
    updateDashboard();
  });
}

function editSuccessPack(i) {
  let sp = successPacks[i];
  $("#successPackClientInput").val(clients[sp.clientIndex] ? clients[sp.clientIndex].clientName : "");
  $("#successPackClientIndex").val(sp.clientIndex);
  $("#successPackDescription").val(sp.description);
  $("#successPackAmount").val(sp.amount);
  $("#successPackCurrency").val(sp.currency);
  $("#successPackDate").val(sp.date);
  currentSuccessPackEditIndex = i;
  $("#addSuccessPackBtn").text("Update Success Pack");
}

function deleteSuccessPack(i) {
  if (confirm("Are you sure?")) {
    successPacks.splice(i, 1);
    saveData();
    renderSuccessPackTable();
    Toastify({
      text: "Success Pack deleted",
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: "#4caf50"
    }).showToast();
    updateDashboard();
  }
}

function renderSuccessPackTable() {
  const tbody = $("#successPackTableBody");
  tbody.empty();
  let sorted = successPacks.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  sorted.forEach((sp) => {
    let originalIndex = successPacks.indexOf(sp);
    const cname = (clients[sp.clientIndex]) ? clients[sp.clientIndex].clientName : "Unknown";
    let originalCell = `${sp.amount} ${sp.currency}`;
    let convertedCell = sp.convertedAmount ? `${sp.convertedAmount.toFixed(2)} USD` : `${sp.amount} USD`;
    let tr = $(`
      <tr>
        <td>${cname}</td>
        <td>${sp.description}</td>
        <td>${originalCell}</td>
        <td>${convertedCell}</td>
        <td>${sp.date}</td>
        <td>
          <button class="btn btn-sm btn-warning mr-1" title="Edit">✏️</button>
          <button class="btn btn-sm btn-danger" title="Delete">🗑️</button>
        </td>
      </tr>
    `);
    tr.find('.btn-warning').click(() => editSuccessPack(originalIndex));
    tr.find('.btn-danger').click(() => deleteSuccessPack(originalIndex));
    tbody.append(tr);
  });
}

/***********************************
 * Targets
 ***********************************/
function populateMonthSelect() {
  const sel = $('#targetMonth');
  sel.empty();
  let now = new Date();
  for (let i = -2; i < 24; i++) {
    let d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    let val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    let label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    sel.append(`<option value="${val}">${label}</option>`);
  }
}

function updateTargetInputs() {
  const m = $('#targetMonth').val();
  if (!m || !targets[m]) {
    $('#recurringTargetInput').val('');
    $('#recurringForecastInput').val('');
    $('#nonRecurringTargetInput').val('');
    $('#nonRecurringForecastInput').val('');
    return;
  }
  $('#recurringTargetInput').val(targets[m].recurring || '');
  $('#recurringForecastInput').val(targets[m].recurringForecast || '');
  $('#nonRecurringTargetInput').val(targets[m].nonRecurring || '');
  $('#nonRecurringForecastInput').val(targets[m].nonRecurringForecast || '');
}

function saveTarget() {
  const m = $('#targetMonth').val();
  const r = parseFloat($('#recurringTargetInput').val()) || 0;
  const rf = parseFloat($('#recurringForecastInput').val()) || 0;
  const nr = parseFloat($('#nonRecurringTargetInput').val()) || 0;
  const nrf = parseFloat($('#nonRecurringForecastInput').val()) || 0;
  targets[m] = { recurring: r, recurringForecast: rf, nonRecurring: nr, nonRecurringForecast: nrf };
  saveData();
  Toastify({
    text: "Target and Forecast saved",
    duration: 3000,
    gravity: "top",
    position: "right",
    backgroundColor: "#4caf50"
  }).showToast();
  updateDashboard();
}

/***********************************
 * Dashboard
 ***********************************/
function updateDashboard() {
  let monthlyData = {}; 
  function ensureMonthKey(m) {
    if (!monthlyData[m]) {
      monthlyData[m] = { recurring: 0, nonRecurring: 0 };
    }
  }
  upsells.forEach(up => {
    let mk = getMonthKey(up.date);
    ensureMonthKey(mk);
    monthlyData[mk].recurring += (up.addedToTarget || 0);
  });
  renews.forEach(rn => {
    let mk = getMonthKey(rn.date);
    ensureMonthKey(mk);
    monthlyData[mk].recurring += (rn.addedToTarget !== undefined ? rn.addedToTarget : (rn.convertedAmount || 0));
  });
  successPacks.forEach(sp => {
    let mk = getMonthKey(sp.date);
    ensureMonthKey(mk);
    monthlyData[mk].nonRecurring += (sp.convertedAmount || 0);
  });
  Object.keys(targets).forEach(m => {
    ensureMonthKey(m);
  });
  const accordion = $('#monthlyPerformanceAccordion');
  accordion.empty();
  let sortedKeys = Object.keys(monthlyData).filter(k => k !== "N/A").sort();
  let currentMonthKey = getMonthKey(getSFLocalDateString());
  let hasCurrent = sortedKeys.includes(currentMonthKey);
  if (sortedKeys.length === 0) {
    accordion.append("<p>No monthly data yet.</p>");
  } else {
    sortedKeys.forEach((mk, idx) => {
      let headingId = `mp-head-${mk}`;
      let collapseId = `mp-col-${mk}`;
      let label = formatMonthLabel(mk);
      let rec = monthlyData[mk].recurring || 0;
      let nrec = monthlyData[mk].nonRecurring || 0;
      let tRec = 0, tNRec = 0, fRec = 0, fNRec = 0;
      if (targets[mk]) {
        tRec = targets[mk].recurring || 0;
        tNRec = targets[mk].nonRecurring || 0;
        fRec = targets[mk].recurringForecast || 0;
        fNRec = targets[mk].nonRecurringForecast || 0;
      }
      let recPercentageValue = tRec ? (rec / tRec) * 100 : 0;
      let recPercentage = recPercentageValue.toFixed(2);
      let nrecPercentageValue = tNRec ? (nrec / tNRec) * 100 : 0;
      let nrecPercentage = nrecPercentageValue.toFixed(2);
      let recForecastPercentageValue = fRec ? (rec / fRec) * 100 : 0;
      let recForecastPercentage = recForecastPercentageValue.toFixed(2);
      let nrecForecastPercentageValue = fNRec ? (nrec / fNRec) * 100 : 0;
      let nrecForecastPercentage = nrecForecastPercentageValue.toFixed(2);

      let angleRec = (recPercentageValue / 100 - 1) * 90;
      let angleNRec = (nrecPercentageValue / 100 - 1) * 90;
      let angleRecForecast = (recForecastPercentageValue / 100 - 1) * 90;
      let angleNRecForecast = (nrecForecastPercentageValue / 100 - 1) * 90;

      // New total percentage calculations
      let totalPercentageValue = 0.85 * recPercentageValue + 0.15 * nrecPercentageValue;
      let totalForecastPercentageValue = 0.85 * recForecastPercentageValue + 0.15 * nrecForecastPercentageValue;

      // New total angle calculations
      let angleTotal = (totalPercentageValue / 100 - 1) * 90;
      let angleTotalForecast = (totalForecastPercentageValue / 100 - 1) * 90;

      const quarterMonths = getQuarterMonths(mk);
      let sumRec = 0, sumNRec = 0, sumTRec = 0, sumTNRec = 0;

      // Somme des données pour les trois mois du trimestre
      quarterMonths.forEach(qm => {
        if (monthlyData[qm]) {
          sumRec += monthlyData[qm].recurring || 0;
          sumNRec += monthlyData[qm].nonRecurring || 0;
        }
        if (targets[qm]) {
          sumTRec += targets[qm].recurring || 0;
          sumTNRec += targets[qm].nonRecurring || 0;
        }
      });

      // Calcul des pourcentages du trimestre
      const quarterRecPercentage = sumTRec > 0 ? (sumRec / sumTRec) * 100 : 0;
      const quarterNRecPercentage = sumTNRec > 0 ? (sumNRec / sumTNRec) * 100 : 0;
      const quarterTotalPercentage = 0.85 * quarterRecPercentage + 0.15 * quarterNRecPercentage;

      // Calcul de l'angle pour le graphique (gauge)
      const angleQuarterTotal = (quarterTotalPercentage / 100 - 1) * 90;

      function getColor(percentage) {
        let value = parseFloat(percentage);
        if (value < 80) return '#FF5252';
        else if (value < 130) return '#088F8F';
        else return '#50C878';
      }

      let card = $(`
        <div class="card">
          <div class="card-header" id="${headingId}">
            <h5 class="mb-0">
              <button class="btn btn-link" data-toggle="collapse" data-target="#${collapseId}"
                aria-expanded="${(hasCurrent ? (mk === currentMonthKey) : (idx === 0)) ? 'true' : 'false'}" aria-controls="${collapseId}">
                ${label}
              </button>
            </h5>
          </div>
          <div id="${collapseId}" class="collapse ${(hasCurrent ? (mk === currentMonthKey) : (idx === 0)) ? 'show' : ''}">
            <div class="card-body">
              <div class="row">
                <div class="col-md-3">
                  <!-- Colonne Recurring (inchangée) -->
                  <h5>Recurring</h5>
                  <div class="gauge">
                    <div class="gauge-background"></div>
                    <div class="needle" style="transform: rotate(-90deg);"></div>
                    <div class="needle-forecast" style="transform: rotate(-90deg); opacity: 0.5;"></div>
                    <div class="gauge-center"></div>
                    <div class="gauge-label left">0%</div>
                    <div class="gauge-label top">100%</div>
                    <div class="gauge-label right">200%</div>
                  </div>
                  <p class="dashbord-current-line">
                    ${rec.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </p>
                  <p>
                    <b>Target</b>
                    ${tRec.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} | 
                    <b style="color: ${getColor(recPercentage)};">${recPercentage}%</b>
                  </p>
                  <p class="dashbord-forecast-line">
                    <b>Forecast</b>
                    ${fRec.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} | 
                    <b style="color: ${getColor(recForecastPercentage)};">${recForecastPercentage}%</b>
                  </p>
                </div>
                <div class="col-md-3">
                  <!-- Colonne Non-Recurring (inchangée) -->
                  <h5>Non-Recurring</h5>
                  <div class="gauge">
                    <div class="gauge-background"></div>
                    <div class="needle" style="transform: rotate(-90deg);"></div>
                    <div class="needle-forecast" style="transform: rotate(-90deg); opacity: 0.5;"></div>
                    <div class="gauge-center"></div>
                    <div class="gauge-label left">0%</div>
                    <div class="gauge-label top">100%</div>
                    <div class="gauge-label right">200%</div>
                  </div>
                  <p class="dashbord-current-line">
                    ${nrec.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </p>
                  <p>
                    <b>Target</b>
                    ${tNRec.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} | 
                    <b style="color: ${getColor(nrecPercentage)};">${nrecPercentage}%</b>
                  </p>
                  <p class="dashbord-forecast-line">
                    <b>Forecast</b>
                    ${fNRec.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} | 
                    <b style="color: ${getColor(nrecForecastPercentage)};">${nrecForecastPercentage}%</b>
                  </p>
                </div>
                <div class="col-md-3">
                  <!-- Colonne Total (inchangée) -->
                  <h5>Total</h5>
                  <div class="gauge">
                    <div class="gauge-background"></div>
                    <div class="needle" style="transform: rotate(-90deg);"></div>
                    <div class="gauge-center"></div>
                    <div class="gauge-label left">0%</div>
                    <div class="gauge-label top">100%</div>
                    <div class="gauge-label right">200%</div>
                  </div>
                  <p class="dashbord-current-line" style="color: ${getColor(totalPercentageValue.toFixed(2))};">
                    ${totalPercentageValue.toFixed(2)}%
                  </p>
                </div>
                <div class="col-md-3">
                  <!-- Nouvelle colonne Trimestre -->
                  <h5>${getQuarterLabel(mk)}</h5>
                  <div class="gauge">
                    <div class="gauge-background"></div>
                    <div class="needle" style="transform: rotate(-90deg);"></div>
                    <div class="gauge-center"></div>
                    <div class="gauge-label left">0%</div>
                    <div class="gauge-label top">100%</div>
                    <div class="gauge-label right">200%</div>
                  </div>
                  <p class="dashbord-current-line" style="color: ${getColor(quarterTotalPercentage.toFixed(2))};">
                    ${quarterTotalPercentage.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      `);
      accordion.append(card);

      setTimeout(() => {
        const recurringGauge = card.find('.col-md-3:nth-child(1) .gauge');
        const nonRecurringGauge = card.find('.col-md-3:nth-child(2) .gauge');
        const totalGauge = card.find('.col-md-3:nth-child(3) .gauge');
        const quarterGauge = card.find('.col-md-3:nth-child(4) .gauge');
        recurringGauge.find('.needle').css('transform', `rotate(${angleRec}deg)`);
        recurringGauge.find('.needle-forecast').css('transform', `rotate(${angleRecForecast}deg)`);
        nonRecurringGauge.find('.needle').css('transform', `rotate(${angleNRec}deg)`);
        nonRecurringGauge.find('.needle-forecast').css('transform', `rotate(${angleNRecForecast}deg)`);
        totalGauge.find('.needle').css('transform', `rotate(${angleTotal}deg)`);
        quarterGauge.find('.needle').css('transform', `rotate(${angleQuarterTotal}deg)`);
      }, 50);
    });
  }
  const upcomingList = $('#upcomingRenewalsList');
  upcomingList.empty();
  let now = new Date();
  let cStart = new Date(now.getFullYear(), now.getMonth(), 1);
  let cNext = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  let upcoming = clients.filter(cl => {
    if (!cl.nextRenewalDate) return false;
    let rd = new Date(cl.nextRenewalDate);
    return rd >= cStart && rd < cNext;
  }).sort((a, b) => new Date(a.nextRenewalDate) - new Date(b.nextRenewalDate));
  if (upcoming.length === 0) {
    upcomingList.append("<li>No upcoming renewals this month.</li>");
  } else {
    upcoming.forEach(u => {
      upcomingList.append(`<li>${u.clientName} - ${u.nextRenewalDate}</li>`);
    });
  }
  if (clients.length === 0) {
    $('#subscriptionDistMsg').text("No data yet.");
  } else {
    let std = 0, custom = 0;
    clients.forEach(cl => {
      if (cl.plan === "Odoo Standard") std++;
      else if (cl.plan === "Odoo Custom") custom++;
    });
    $('#subscriptionDistMsg').text(`Standard: ${std}, Custom: ${custom}`);
  }
  let sortedTKeys = Object.keys(targets).sort();
  // Replace previous overviewHTML build with a Bootstrap table view:
  let overviewHTML = `<table class="table table-bordered">
    <thead>
      <tr>
        <th>Month</th>
        <th>Recurring Target</th>
        <th>Recurring Forecast</th>
        <th>Non-Recurring Target</th>
        <th>Non-Recurring Forecast</th>
      </tr>
    </thead>
    <tbody>`;
  sortedTKeys.forEach(k => {
    let label = formatMonthLabel(k);
    let rec = targets[k].recurring || 0;
    let rf = targets[k].recurringForecast || 0;
    let nrec = targets[k].nonRecurring || 0;
    let nrf = targets[k].nonRecurringForecast || 0;
    overviewHTML += `<tr>
      <td><strong>${label}</strong></td>
      <td>$${rec}</td>
      <td>$${rf}</td>
      <td>$${nrec}</td>
      <td>$${nrf}</td>
    </tr>`;
  });
  overviewHTML += `</tbody></table>`;
  $('#yearlyOverviewMsg').html(overviewHTML || "No data yet.");
}


// Retourne les trois mois d'un trimestre pour une clé de mois donnée
function getQuarterMonths(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  let quarterStartMonth;
  if (month <= 3) quarterStartMonth = 1;
  else if (month <= 6) quarterStartMonth = 4;
  else if (month <= 9) quarterStartMonth = 7;
  else quarterStartMonth = 10;
  return [
    `${year}-${String(quarterStartMonth).padStart(2, '0')}`,
    `${year}-${String(quarterStartMonth + 1).padStart(2, '0')}`,
    `${year}-${String(quarterStartMonth + 2).padStart(2, '0')}`
  ];
}

// Retourne l'étiquette du trimestre (ex. "Q1 2023")
function getQuarterLabel(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  if (month >= 1 && month <= 3) return `Q1 ${year}`;
  if (month >= 4 && month <= 6) return `Q2 ${year}`;
  if (month >= 7 && month <= 9) return `Q3 ${year}`;
  return `Q4 ${year}`;
}


/***********************************
 * Export automatique périodique
 ***********************************/
function setupAutomaticExport() {
  // Marquer que l'export automatique est actif
  window.autoExportActive = true;
  
  // Première vérification immédiate
  checkAndExportIfNeeded();
  
  // Configurer la vérification périodique (toutes les 24h)
  const scheduleNextExport = function() {
    // Si l'export auto a été désactivé entre-temps, ne pas programmer le prochain
    if (settings.enableAutoExport === false) {
      window.autoExportActive = false;
      return;
    }
    
    const delay = 24 * 60 * 60 * 1000; // 24 heures en millisecondes
    console.log(`Next automatic export check scheduled in: ${delay/1000/60/60} hours`);
    
    setTimeout(function() {
      // Vérifier à nouveau au moment de l'exécution si l'export auto est toujours activé
      if (settings.enableAutoExport !== false) {
        checkAndExportIfNeeded();
        scheduleNextExport(); // Programmer la prochaine vérification
      } else {
        window.autoExportActive = false;
      }
    }, delay);
  };
  
  // Lancer le cycle
  scheduleNextExport();
}

function checkAndExportIfNeeded() {
  // Récupérer la date du dernier export automatique
  const lastExportDate = localStorage.getItem('lastAutomaticExportDate');
  const now = new Date();
  const dateStrAuto = now.toISOString().split('T')[0];
  
  // Si aucun export n'a été fait ou si le dernier export date de plus de 24 heures
  if (!lastExportDate || (now - new Date(lastExportDate)) > 24 * 60 * 60 * 1000) {
    console.log("Running automatic export...");
    
    // Exporter vers export_daily.json
    exportDataToJson(`odoo-cstd-export-auto-${dateStrAuto}.json`, true);
    
    // Mettre à jour la date du dernier export automatique
    localStorage.setItem('lastAutomaticExportDate', now.toISOString());
    
    console.log("Automatic export completed:", now.toLocaleString());
  } else {
    console.log("No need for automatic export, last export:", new Date(lastExportDate).toLocaleString());
  }
}

function exportDataToJson(filename, isAutomatic = false) {
  // Préparer les données pour l'export
  const data = {
    clients: clients,
    upsells: upsells,
    successPacks: successPacks,
    renews: renews,
    targets: targets,
    settings: settings,
    lastUpdated: new Date().toISOString()
  };
  
  // Convertir en JSON
  const jsonData = JSON.stringify(data, null, 2);
  
  // Créer et télécharger le fichier
  const blob = new Blob([jsonData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  // Afficher une notification
  Toastify({
    text: isAutomatic ? `Automatic export to ${filename}` : `Data exported to ${filename}`,
    duration: 3000,
    gravity: "top",
    position: "right",
    backgroundColor: "#4caf50"
  }).showToast();
}

/***********************************
 * Rafraîchissement automatique des taux de change
 ***********************************/
function setupAutomaticRatesRefresh() {
  // Configurer la vérification périodique (toutes les 24h)
  const scheduleNextRefresh = function() {
    const delay = 24 * 60 * 60 * 1000; // 24 heures en millisecondes
    console.log(`Prochain rafraîchissement des taux de change programmé dans: ${delay/1000/60/60} heures`);
    
    setTimeout(function() {
      checkAndRefreshRates();
      scheduleNextRefresh(); // Programmer la prochaine vérification
    }, delay);
  };
  
  // Fonction pour vérifier si un rafraîchissement est nécessaire
  const checkAndRefreshRates = function() {
    const storedTimestamp = localStorage.getItem('conversionRatesTimestamp');
    const now = Date.now();
    
    // Si pas de taux stockés ou si les taux datent de plus de 24 heures
    if (!storedTimestamp || (now - parseInt(storedTimestamp, 10)) >= 24 * 60 * 60 * 1000) {
      console.log("Rafraîchissement automatique des taux de change...");
      fetchConversionRates(function() {
        console.log("Rafraîchissement des taux terminé:", new Date().toLocaleString());
      }, true);
    } else {
      console.log("Pas besoin de rafraîchir les taux, dernier rafraîchissement:", new Date(parseInt(storedTimestamp, 10)).toLocaleString());
    }
  };
  
  // Lancer le cycle
  scheduleNextRefresh();
}


/***********************************
 * Import XLSX
 ***********************************/
function handleFile(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const data = new Uint8Array(e.target.result);
    try {
      const wb = new ExcelJS.Workbook();
      wb.xlsx.load(data).then(function() {
        // Ajout d'une ligne client vierge à l'index 0 pour contrer le bug avec le record 0
        clients = [];
        clients.push({
          clientName: "no client",
          plan: "",
          hosting: "",
          amount: 0,
          currency: "USD",
          frequency: "",
          users: 0,
          nextRenewalDate: "",
          status: "",
          odooLink: ""
        });
        
        const ws = wb.worksheets[0];
        
        // Initialize column mapping with default null values
        const columnMap = {
          customerIndex: null,
          nextInvoiceIndex: null,
          totalRecurringIndex: null,
          recurringPlanIndex: null,
          statusIndex: null
        };
        
        // Read header row to identify column positions
        if (ws.rowCount > 0) {
          const headerRow = ws.getRow(1);
          headerRow.eachCell({ includeEmpty: false }, function(cell, colNumber) {
            const headerText = cell.value ? cell.value.toString().trim() : "";
            
            // Map column names to their indices
            if (headerText.toLowerCase() === "customer") {
              columnMap.customerIndex = colNumber;
            } else if (headerText.toLowerCase() === "next invoice") {
              columnMap.nextInvoiceIndex = colNumber;
            } else if (headerText.toLowerCase() === "total recurring") {
              columnMap.totalRecurringIndex = colNumber;
            } else if (headerText.toLowerCase() === "recurring plan") {
              columnMap.recurringPlanIndex = colNumber;
            } else if (headerText.toLowerCase() === "subscription status") {
              columnMap.statusIndex = colNumber;
            }
          });
        }
        
        // Validate that all required columns were found
        const missingColumns = [];
        if (!columnMap.customerIndex) missingColumns.push("Customer");
        if (!columnMap.nextInvoiceIndex) missingColumns.push("Next Invoice");
        if (!columnMap.totalRecurringIndex) missingColumns.push("Total Recurring");
        if (!columnMap.recurringPlanIndex) missingColumns.push("Recurring Plan");
        if (!columnMap.statusIndex) missingColumns.push("Subscription Status");
        
        if (missingColumns.length > 0) {
          Toastify({
            text: `Import failed: Missing required columns: ${missingColumns.join(", ")}`,
            duration: 5000,
            gravity: "top",
            position: "right",
            backgroundColor: "#f44336"
          }).showToast();
          return;
        }
        
        // Process data rows
        ws.eachRow({ includeEmpty: false }, function(row, rowNumber) {
          if (rowNumber === 1) return; // skip header
          
          // Extract data using the column mapping
          const cName = row.getCell(columnMap.customerIndex).value ? 
                        row.getCell(columnMap.customerIndex).value.toString().trim() : "";
          
          const nextInv = row.getCell(columnMap.nextInvoiceIndex).value ? 
                         formatDate(row.getCell(columnMap.nextInvoiceIndex).value) : "";
          
          const totRecCell = row.getCell(columnMap.totalRecurringIndex);
          const totRecRaw = totRecCell.value;
          
          const planVal = row.getCell(columnMap.recurringPlanIndex).value ? 
                         row.getCell(columnMap.recurringPlanIndex).value.toString().trim() : "";
          
          const statusVal = row.getCell(columnMap.statusIndex).value ? 
                           row.getCell(columnMap.statusIndex).value.toString().trim() : "In Progress";
          
          // Only process rows with valid customer name and total recurring value
          if (cName && totRecRaw) {
            const parsed = parseCurrencyAndAmount(totRecRaw, totRecCell);
            const freq = parseFrequency(planVal);
            
            const clientObj = {
              clientName: cName,
              plan: "",
              hosting: "",
              amount: parsed.amount,
              currency: parsed.currency || "USD",
              frequency: freq,
              users: 0,
              nextRenewalDate: nextInv || "",
              status: statusVal,
              odooLink: ""
            };
            
            convertAmount(clientObj.amount, clientObj.currency, function(converted, rate) {
              clientObj.convertedAmount = converted;
              clientObj.conversionRate = rate;
              clients.push(clientObj);
            });
          }
        });
        
        setTimeout(function() {
          saveData();
          renderClientTable();
          refreshClientSelects();
          Toastify({
            text: `Import completed. ${clients.length - 1} clients imported.`,
            duration: 3000,
            gravity: "top",
            position: "right",
            backgroundColor: "#4caf50"
          }).showToast();
          updateDashboard();
        }, 300);
      }).catch(function(err) {
        Toastify({
          text: "Error loading Excel: " + err,
          duration: 3000,
          gravity: "top",
          position: "right",
          backgroundColor: "#f44336"
        }).showToast();
      });
    } catch (error) {
      console.error("Error importing Excel file:", error);
      Toastify({
        text: "Error importing Excel file: " + error.message,
        duration: 3000,
        gravity: "top",
        position: "right",
        backgroundColor: "#f44336"
      }).showToast();
    }
  };
  reader.readAsArrayBuffer(file);
}

function formatDate(val) {
  if (!isNaN(Date.parse(val))) {
    return getSFLocalDateString(new Date(val));
  }
  return val;
}

function parseCurrencyAndAmount(rawValue, cell) {
  if (!rawValue) return { amount: 0, currency: "" };
  if (typeof rawValue === "number") {
    let ccy = "USD";
    if (cell && cell.numFmt && cell.numFmt.indexOf("€") !== -1) {
      ccy = "EUR";
    }
    return { amount: rawValue, currency: ccy };
  }
  let upper = rawValue.toString().toUpperCase();
  const currencySymbols = {
    "US$": "USD", "AU$": "AUD", "NZ$": "NZD", "C$": "CAD", "CA$": "CAD", "RD$": "DOP",
    "AR$": "ARS", "CL$": "CLP", "COL$": "COP",
    "$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₹": "INR",
    "₩": "KRW", "₽": "RUB", "₱": "PHP", "R$": "BRL", "₺": "TRY",
    "₪": "ILS", "฿": "THB", "₫": "VND"
  };
  const sortedSymbols = Object.keys(currencySymbols).sort((a, b) => b.length - a.length);
  let detectedCurrency = "";
  for (const sym of sortedSymbols) {
    if (upper.includes(sym)) {
      detectedCurrency = currencySymbols[sym];
      break;
    }
  }
  if (!detectedCurrency) {
    let match = upper.match(/\b[A-Z]{2,4}\b/);
    if (match) {
      detectedCurrency = match[0];
    }
  }
  let numericString = upper.replace(/[^\d.,-]/g, "").replace(/,/g, ".");
  let amt = parseFloat(numericString) || 0;
  return { amount: amt, currency: detectedCurrency };
}

function parseFrequency(val) {
  if (!val) return "";
  let s = val.toLowerCase().trim();
  if (s.includes("month")) return "Monthly";
  if (s.includes("year")) {
    let m = s.match(/(\d+)/);
    return m ? `Yearly (${m[1]})` : "Yearly (1)";
  }
  return "";
}
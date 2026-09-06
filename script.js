(() => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STORAGE_KEY = 'mancini_reservas';
  const RESTAURANT_WHATSAPP = '5511944815707';
  const WEEKDAY_LABELS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const MONTH_LABELS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  const partyOptions = document.getElementById('party-options');
  const dateInput = document.getElementById('date-input');
  const dateHint = document.getElementById('date-hint');
  const timeOptions = document.getElementById('time-options');
  const form = document.getElementById('booking-form');
  const errorEl = document.getElementById('booking-error');
  const bookingsList = document.getElementById('bookings-list');

  let selectedParty = '2';
  let selectedDate = null;
  let selectedTime = null;

  function formatDateLabel(date) {
    return `${WEEKDAY_LABELS[date.getDay()]} ${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  function isoDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  // Open 11:30 every day. Close times pass midnight on busy nights, expressed
  // as minutes past the start of the service day (e.g. 1am close = 25:00).
  function hoursForWeekday(day) {
    const open = 11 * 60 + 30;
    if (day === 0) return { open, close: 24 * 60 };
    if (day >= 1 && day <= 3) return { open, close: 25 * 60 };
    if (day === 4) return { open, close: 25 * 60 + 30 };
    return { open, close: 26 * 60 + 30 };
  }

  function minutesToLabel(minutes) {
    const isNextDay = minutes >= 24 * 60;
    const h = String(Math.floor(minutes / 60) % 24).padStart(2, '0');
    const m = String(minutes % 60).padStart(2, '0');
    return isNextDay ? `${h}:${m} (madrugada)` : `${h}:${m}`;
  }

  function setupDateInput() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 90);
    dateInput.min = isoDate(today);
    dateInput.max = isoDate(maxDate);
  }

  function hashSlot(dateStr, index) {
    let hash = 0;
    const str = dateStr + '-' + index;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) % 97;
    }
    return hash;
  }

  function buildTimeOptions(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const hours = hoursForWeekday(date.getDay());
    timeOptions.innerHTML = '';

    let index = 0;
    for (let minutes = hours.open; minutes < hours.close; minutes += 30) {
      const label = minutesToLabel(minutes);
      const occupied = hashSlot(dateStr, index) < 22;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option-chip small' + (occupied ? ' disabled' : '');
      btn.dataset.value = label;
      btn.textContent = label;
      if (occupied) {
        btn.disabled = true;
        btn.title = 'Horário indisponível';
      }
      timeOptions.appendChild(btn);
      index += 1;
    }
  }

  function handleDateChange() {
    const value = dateInput.value;
    selectedTime = null;

    if (!value) {
      selectedDate = null;
      timeOptions.innerHTML = '<p class="booking-hint">Escolha uma data para ver os horários disponíveis.</p>';
      dateHint.hidden = true;
      return;
    }

    dateHint.hidden = true;
    selectedDate = value;
    buildTimeOptions(value);
  }

  function selectChip(container, target, onSelect) {
    container.querySelectorAll('.option-chip').forEach(chip => chip.classList.remove('active'));
    target.classList.add('active');
    onSelect(target.dataset.value);
  }

  partyOptions.addEventListener('click', (e) => {
    const chip = e.target.closest('.option-chip');
    if (!chip) return;
    selectChip(partyOptions, chip, (value) => { selectedParty = value; });
  });

  dateInput.addEventListener('change', handleDateChange);

  timeOptions.addEventListener('click', (e) => {
    const chip = e.target.closest('.option-chip');
    if (!chip || chip.disabled) return;
    selectChip(timeOptions, chip, (value) => { selectedTime = value; });
  });

  function loadBookings() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveBookings(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function formatStoredDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return `${String(date.getDate()).padStart(2, '0')} de ${MONTH_LABELS[date.getMonth()]}`;
  }

  function buildReservationMessage(kind, b) {
    const headers = {
      new: 'Nova reserva pelo site: Famiglia Mancini Trattoria',
      edit: 'Alteração de reserva: Famiglia Mancini Trattoria',
      cancel: 'Cancelamento de reserva: Famiglia Mancini Trattoria'
    };
    const closings = {
      new: null,
      edit: 'Olá! Gostaria de alterar esta reserva. Podem me ajudar com a nova data/horário?',
      cancel: 'Olá! Gostaria de cancelar esta reserva, por favor.'
    };
    const lines = [
      headers[kind],
      `Nome: ${b.name}`,
      `Pessoas: ${b.party}`,
      `Data: ${formatStoredDate(b.date)}`,
      `Horário: ${b.time}`,
      `WhatsApp do cliente: ${b.phone}`
    ];
    if (b.note) lines.push(`Observações: ${b.note}`);
    if (closings[kind]) lines.push('', closings[kind]);
    return lines.join('\n');
  }

  function sendReservationWhatsApp(kind, b) {
    const message = buildReservationMessage(kind, b);
    window.open(`https://wa.me/${RESTAURANT_WHATSAPP}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  }

  function renderBookings() {
    const bookings = loadBookings();
    if (!bookings.length) {
      bookingsList.innerHTML = '<p class="bookings-empty">Nenhuma reserva ainda.</p>';
      return;
    }
    bookingsList.innerHTML = bookings.map(b => `
      <div class="booking-item" data-id="${b.id}">
        <div>
          <strong>${b.party} pessoas</strong>
          <span>${formatStoredDate(b.date)} às ${b.time} · ${b.name}</span>
        </div>
        <div class="booking-item-actions">
          <button type="button" class="booking-edit" data-id="${b.id}">Editar</button>
          <button type="button" class="booking-cancel" data-id="${b.id}">Cancelar</button>
        </div>
      </div>
    `).join('');
  }

  bookingsList.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.booking-edit');
    const cancelBtn = e.target.closest('.booking-cancel');
    if (!editBtn && !cancelBtn) return;

    const id = (editBtn || cancelBtn).dataset.id;
    const bookings = loadBookings();
    const booking = bookings.find(b => String(b.id) === id);
    if (!booking) return;

    if (editBtn) {
      sendReservationWhatsApp('edit', booking);
      return;
    }

    sendReservationWhatsApp('cancel', booking);
    saveBookings(bookings.filter(b => String(b.id) !== id));
    renderBookings();
  });

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function clearError() {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearError();

    const name = document.getElementById('booking-name').value.trim();
    const phone = document.getElementById('booking-phone').value.trim();
    const note = document.getElementById('booking-note').value.trim();

    if (!selectedDate) return showError('Escolha uma data.');
    if (!selectedTime) return showError('Escolha um horário.');
    if (!name) return showError('Informe seu nome.');
    if (!phone) return showError('Informe seu WhatsApp.');

    const newBooking = {
      id: Date.now(),
      party: selectedParty,
      date: selectedDate,
      time: selectedTime,
      name,
      phone,
      note
    };
    const bookings = loadBookings();
    bookings.unshift(newBooking);
    saveBookings(bookings);
    renderBookings();

    sendReservationWhatsApp('new', newBooking);

    form.reset();
    selectedParty = '2';
    selectedDate = null;
    selectedTime = null;
    partyOptions.querySelectorAll('.option-chip').forEach((c, i) => c.classList.toggle('active', i === 0));
    dateHint.hidden = true;
    timeOptions.innerHTML = '<p class="booking-hint">Escolha uma data para ver os horários disponíveis.</p>';

    document.querySelector('.my-bookings').scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'nearest' });
  });

  setupDateInput();
  renderBookings();

  // FAQ accordion
  document.querySelectorAll('.faq-item').forEach(item => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    question.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(other => {
        if (other !== item) {
          other.classList.remove('open');
          other.querySelector('.faq-answer').style.maxHeight = null;
        }
      });
      item.classList.toggle('open', !isOpen);
      answer.style.maxHeight = !isOpen ? `${answer.scrollHeight}px` : null;
    });
  });

  // Scroll-triggered reveal
  const revealEls = document.querySelectorAll('[data-reveal]');
  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(el => el.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const delay = entry.target.getAttribute('data-delay') || 0;
          entry.target.style.transitionDelay = `${delay * 90}ms`;
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(el => revealObserver.observe(el));
  }

  // Header shrink + active link + back-to-top
  const header = document.getElementById('site-header');
  const backToTop = document.getElementById('back-to-top');
  const pageSections = document.querySelectorAll('main section[id]');
  const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');

  function onScroll() {
    const scrollY = window.scrollY;
    header.classList.toggle('scrolled', scrollY > 20);
    backToTop.classList.toggle('show', scrollY > 600);

    let currentId = '';
    pageSections.forEach(section => {
      const top = section.offsetTop - 160;
      if (scrollY >= top) currentId = section.id;
    });
    navAnchors.forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${currentId}`));
  }

  let scrollScheduled = false;
  window.addEventListener('scroll', () => {
    if (scrollScheduled) return;
    scrollScheduled = true;
    setTimeout(() => { onScroll(); scrollScheduled = false; }, 50);
  });

  onScroll();

  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  });
})();

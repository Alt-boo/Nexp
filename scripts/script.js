document.addEventListener("DOMContentLoaded", () => {
  const themeToggle = document.getElementById("theme-toggle");
  const htmlElement = document.documentElement;

  // 1. Функция для получения текущей темы
  const getPreferredTheme = () => {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme) {
      return storedTheme;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  };

  const setTheme = (theme) => {
    htmlElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  };

  // 3. Инициализация при загрузке
  const currentTheme = getPreferredTheme();
  setTheme(currentTheme);

  // 4. Обработка клика
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const currentTheme = htmlElement.getAttribute("data-theme");
      const newTheme = currentTheme === "dark" ? "light" : "dark";
      setTheme(newTheme);
    });
  }

  // 5. Следим за изменением системной темы
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      if (!localStorage.getItem("theme")) {
        setTheme(e.matches ? "dark" : "light");
      }
    });
});

// ============================================
// 6. Логика работы аккордеона (общая для всех)
// ============================================
const accordionHeaders = document.querySelectorAll(
  ".accordion .accordion_header",
);

if (accordionHeaders.length > 0) {
  accordionHeaders.forEach((header) => {
    header.addEventListener("click", () => {
      const item = header.parentElement;
      const content = header.nextElementSibling;
      const isActive = item.classList.contains("active");

      // Закрываем все открытые панели в пределах одного аккордеона
      const parentAccordion = item.closest(".accordion");
      if (parentAccordion) {
        parentAccordion
          .querySelectorAll(".accordion_item")
          .forEach((otherItem) => {
            if (otherItem !== item && otherItem.classList.contains("active")) {
              otherItem.classList.remove("active");
              otherItem
                .querySelector(".accordion_header")
                .setAttribute("aria-expanded", "false");
              otherItem.querySelector(".accordion_content").style.maxHeight =
                null;
            }
          });
      }

      // Переключаем текущую панель
      if (isActive) {
        item.classList.remove("active");
        header.setAttribute("aria-expanded", "false");
        content.style.maxHeight = null;
      } else {
        item.classList.add("active");
        header.setAttribute("aria-expanded", "true");
        content.style.maxHeight = content.scrollHeight + "px";
      }
    });
  });
}

// ============================================
// 7. Универсальный поиск по аккордеонам
//    (для "Перечня продукции" и "Кодов ТНВЭД")
//    Подсветка реализована через DOM API — innerHTML не используется.
// ============================================

/**
 * Экранирует спецсимволы регулярного выражения в строке запроса,
 * чтобы пользовательский ввод не сломал RegExp.
 */
const escapeRegExp = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Безопасно подсвечивает совпадения в элементе.
 * Очищает содержимое элемента и заполняет его заново:
 *   - обычный текст → текстовые узлы
 *   - совпадения → элементы <mark>
 * Никакой HTML-разметки из строк не вставляется.
 *
 * @param {HTMLElement} element — целевой элемент (.accordion_text-content)
 * @param {string} text — исходный текст
 * @param {string} query — поисковый запрос
 */
const highlightText = (element, text, query) => {
  // Полностью очищаем элемент от прежнего содержимого
  element.textContent = "";

  // Если запрос пустой — просто вставляем исходный текст
  if (!query.trim()) {
    element.textContent = text;
    return;
  }

  const regex = new RegExp(`(${escapeRegExp(query)})`, "gi");

  let lastIndex = 0;
  let match;
  regex.lastIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    // Текст до совпадения — обычный текстовый узел
    if (match.index > lastIndex) {
      element.appendChild(
        document.createTextNode(text.slice(lastIndex, match.index)),
      );
    }

    // Само совпадение оборачиваем в <mark>
    const mark = document.createElement("mark");
    mark.textContent = match[0]; // ← безопасно: трактуется как текст
    element.appendChild(mark);

    lastIndex = match.index + match[0].length;

    // Защита от бесконечного цикла при пустых совпадениях
    if (match[0].length === 0) {
      regex.lastIndex++;
    }
  }

  // Остаток текста после последнего совпадения
  if (lastIndex < text.length) {
    element.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
};

const searchForms = document.querySelectorAll('[id$="SearchForm"]');

searchForms.forEach((form) => {
  // Находим соответствующий инпут для этой формы
  const inputId = form.id.replace("Form", "Input");
  const searchInput = document.getElementById(inputId);

  // Ищем ближайшую секцию, содержащую аккордеон
  const parentSection = form.closest("section");
  const accordionItems = parentSection
    ? parentSection.querySelectorAll(".accordion_item")
    : [];

  /**
   * Восстанавливает исходный текст во всех панелях секции
   * и закрывает их.
   */
  const resetSearch = () => {
    accordionItems.forEach((item) => {
      const textContent = item.querySelector(".accordion_text-content");
      if (!textContent) return;

      // Восстанавливаем оригинальный текст (безопасно, через textContent)
      if (textContent.dataset.originalText) {
        textContent.textContent = textContent.dataset.originalText;
      }

      // Закрываем панель
      item.classList.remove("active");
      item
        .querySelector(".accordion_header")
        .setAttribute("aria-expanded", "false");
      item.querySelector(".accordion_content").style.maxHeight = null;
    });
  };

  /**
   * Основная функция поиска.
   * Раскрывает панели с совпадениями и подсвечивает их.
   */
  const performSearch = (query) => {
    const trimmedQuery = query.trim().toLowerCase();

    // Пустой запрос — сбрасываем всё
    if (!trimmedQuery) {
      resetSearch();
      return;
    }

    let foundAny = false;

    accordionItems.forEach((item) => {
      const textContent = item.querySelector(".accordion_text-content");
      if (!textContent) return;

      // При первом поиске сохраняем оригинальный текст
      if (!textContent.dataset.originalText) {
        textContent.dataset.originalText = textContent.textContent;
      }

      const originalText = textContent.dataset.originalText;
      const isMatch = originalText.toLowerCase().includes(trimmedQuery);
      const content = item.querySelector(".accordion_content");
      const header = item.querySelector(".accordion_header");

      if (isMatch) {
        foundAny = true;

        // Безопасная подсветка через DOM API
        highlightText(textContent, originalText, query);

        // Раскрываем панель
        item.classList.add("active");
        header.setAttribute("aria-expanded", "true");
        content.style.maxHeight = content.scrollHeight + "px";
      } else {
        // Нет совпадения — восстанавливаем текст и закрываем панель
        textContent.textContent = originalText;
        item.classList.remove("active");
        header.setAttribute("aria-expanded", "false");
        content.style.maxHeight = null;
      }
    });

    if (!foundAny) {
      console.log("Ничего не найдено по запросу:", query);
    }
  };

  // Обработка отправки формы (кнопка "Поиск" или Enter)
  if (form && searchInput) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      performSearch(searchInput.value);
    });
  }
});

// ============================================
// 8. Аккордеон карточек экспертов
// ============================================
const expertAccordions = document.querySelectorAll(".expert-accordion");

if (expertAccordions.length > 0) {
  /**
   * Закрывает карточку эксперта:
   * — снимает класс active,
   * — сбрасывает max-height у контента,
   * — возвращает aria-expanded="false" шапке.
   */
  const closeExpertCard = (accordion) => {
    const header = accordion.querySelector(".expert-accordion_header");
    const content = accordion.querySelector(".expert-accordion_content");

    accordion.classList.remove("active");
    if (header) header.setAttribute("aria-expanded", "false");
    if (content) content.style.maxHeight = null;
  };

  expertAccordions.forEach((accordion) => {
    const header = accordion.querySelector(".expert-accordion_header");
    const content = accordion.querySelector(".expert-accordion_content");
    const closeBtn = accordion.querySelector(".expert-accordion_close");

    if (!header || !content) return;

    // Открытие/закрытие по клику на шапку
    header.addEventListener("click", () => {
      const isActive = accordion.classList.contains("active");

      // Закрываем все остальные открытые карточки
      expertAccordions.forEach((other) => {
        if (other !== accordion && other.classList.contains("active")) {
          closeExpertCard(other);
        }
      });

      if (isActive) {
        closeExpertCard(accordion);
      } else {
        accordion.classList.add("active");
        header.setAttribute("aria-expanded", "true");
        // Считаем scrollHeight после добавления класса active,
        // чтобы учесть padding в .expert-accordion.active .expert-accordion_content
        requestAnimationFrame(() => {
          content.style.maxHeight = content.scrollHeight + "px";
        });
      }
    });

    // Закрытие по клику на крестик
    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // не даём событию дойти до header (на всякий случай)
        closeExpertCard(accordion);
      });
    }
  });
}

// ============================================
// 8.6. Галерея на главной странице
//      Нативный скролл + IntersectionObserver + точки + клик по карточке
// ============================================
(function initHomeGallery() {
  const galleryTrack = document.getElementById("galleryTrack");
  const dots = document.querySelectorAll(".gallery-dots .dot");

  if (!galleryTrack || dots.length === 0) return;

  const cards = Array.from(galleryTrack.querySelectorAll(".gallery-card"));
  const container = galleryTrack.parentElement; // .gallery-track-container

  if (!container || cards.length === 0) return;

  // ---------- 1. Синхронизация активной точки со скроллом ----------
  const observer = new IntersectionObserver(
    (entries) => {
      // Из всех пересекающихся карточек выбираем ту, что ближе к центру
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

      if (visible.length === 0) return;

      const activeCard = visible[0].target;
      const index = cards.indexOf(activeCard);

      if (index !== -1) {
        updateActiveDot(index);
      }
    },
    {
      root: container,
      threshold: [0.5, 0.75, 1],
    },
  );

  cards.forEach((card) => observer.observe(card));

  // ---------- 2. Обновление активной точки ----------
  const updateActiveDot = (index) => {
    dots.forEach((dot, i) => {
      const isActive = i === index;
      dot.classList.toggle("active", isActive);
      dot.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  };

  // ---------- 3. Клик по точке → плавный скролл к карточке ----------
  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => {
      const card = cards[i];
      if (!card) return;

      card.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    });
  });

  // ---------- 4. Клик по карточке → переход по data-link ----------
  cards.forEach((card) => {
    card.addEventListener("click", (e) => {
      // Если кликнули по внутренней ссылке .card-link — не перехватываем
      if (e.target.closest(".card-link")) return;

      const link = card.dataset.link;
      if (link && link !== "#") {
        window.location.href = link;
      }
    });

    // Поддержка клавиатуры (Enter/Space) для карточек с tabindex="0"
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const link = card.dataset.link;
        if (link && link !== "#") {
          window.location.href = link;
        }
      }
    });
  });

  // ---------- 5. Инициализация активной точки ----------
  // Если в HTML уже есть .active — синхронизируем aria
  // Если нет — ставим первую
  const initialActive = Array.from(dots).findIndex((d) =>
    d.classList.contains("active"),
  );
  updateActiveDot(initialActive >= 0 ? initialActive : 0);
})();

// ============================================
// 9. Капча в форме обратной связи ВРЕМЕННО!!!!!!!
/**
 * Сейчас капча — клиентская (полностью в браузере).
 * Это защищает от ботов-скриптов «низкого уровня», но не от целенаправленного обхода
 * Для реальной защиты:
 * код должен генерироваться на сервере и храниться в сессии,
 * при submit фронт отправляет введённое значение на сервер,
 * сервер сравнивает и возвращает ответ
 * Нужно переписать initCaptcha так, чтобы код приходил с бэкенда, а validate делал fetch-запрос
 */
// ============================================

/**
 * Генерирует случайный код из 6 символов:
 * заглавные буквы + цифры (без похожих символов типа O/0, I/1).
 */
const generateCaptchaCode = (length = 6) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

/**
 * Инициализирует капчу: рисует код, вешает обновление,
 * возвращает объект с текущим кодом и методами управления.
 */
const initCaptcha = (displayEl, refreshBtn, inputEl, errorEl) => {
  let currentCode = "";

  const render = () => {
    currentCode = generateCaptchaCode();
    displayEl.textContent = currentCode;

    // Сбрасываем состояние ошибки при обновлении
    inputEl.value = "";
    inputEl.classList.remove("is-invalid");
    if (errorEl) errorEl.hidden = true;
  };

  const refresh = () => render();

  const validate = () => {
    const userValue = inputEl.value.trim().toUpperCase();
    const isValid = userValue === currentCode;

    if (!isValid) {
      inputEl.classList.add("is-invalid");
      if (errorEl) errorEl.hidden = false;
    } else {
      inputEl.classList.remove("is-invalid");
      if (errorEl) errorEl.hidden = true;
    }

    return isValid;
  };

  // Первичная отрисовка
  render();

  // Кнопка обновления
  if (refreshBtn) {
    refreshBtn.addEventListener("click", refresh);
  }

  // Снимаем ошибку, как только пользователь начал печатать
  if (inputEl) {
    inputEl.addEventListener("input", () => {
      inputEl.classList.remove("is-invalid");
      if (errorEl) errorEl.hidden = true;
    });
  }

  return { validate, refresh, getCode: () => currentCode };
};

/**
 * Подключает капчу ко всем формам обратной связи на странице.
 * Каждая форма ищет свои элементы по id внутри себя.
 */
document.querySelectorAll(".contact-form").forEach((form) => {
  const displayEl = form.querySelector(".contact-form_captcha-code");
  const refreshBtn = form.querySelector(".contact-form_captcha-refresh");
  const inputEl = form.querySelector(".contact-form_input_captcha");
  const errorEl = form.querySelector(".contact-form_captcha-error");

  if (!displayEl || !inputEl) return;

  const captcha = initCaptcha(displayEl, refreshBtn, inputEl, errorEl);

  // Валидация при отправке формы
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const isCaptchaValid = captcha.validate();
    const isFormValid = form.checkValidity();

    if (!isCaptchaValid) {
      inputEl.focus();
      return;
    }

    if (!isFormValid) {
      form.reportValidity();
      return;
    }

    // Успешная отправка (здесь — заглушка)
    console.log("Форма отправлена", {
      name: form.name.value,
      email: form.email.value,
      phone: form.phone.value,
      message: form.message.value,
    });

    form.reset();
    captcha.refresh(); // Обновляем капчу после отправки
  });
});

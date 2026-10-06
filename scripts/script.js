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
const accordionHeaders = document.querySelectorAll(".accordion__header");

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
          .querySelectorAll(".accordion__item")
          .forEach((otherItem) => {
            if (otherItem !== item && otherItem.classList.contains("active")) {
              otherItem.classList.remove("active");
              otherItem
                .querySelector(".accordion__header")
                .setAttribute("aria-expanded", "false");
              otherItem.querySelector(".accordion__content").style.maxHeight =
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
 * @param {HTMLElement} element — целевой элемент (.accordion__text-content)
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
    ? parentSection.querySelectorAll(".accordion__item")
    : [];

  /**
   * Восстанавливает исходный текст во всех панелях секции
   * и закрывает их.
   */
  const resetSearch = () => {
    accordionItems.forEach((item) => {
      const textContent = item.querySelector(".accordion__text-content");
      if (!textContent) return;

      // Восстанавливаем оригинальный текст (безопасно, через textContent)
      if (textContent.dataset.originalText) {
        textContent.textContent = textContent.dataset.originalText;
      }

      // Закрываем панель
      item.classList.remove("active");
      item
        .querySelector(".accordion__header")
        .setAttribute("aria-expanded", "false");
      item.querySelector(".accordion__content").style.maxHeight = null;
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
      const textContent = item.querySelector(".accordion__text-content");
      if (!textContent) return;

      // При первом поиске сохраняем оригинальный текст
      if (!textContent.dataset.originalText) {
        textContent.dataset.originalText = textContent.textContent;
      }

      const originalText = textContent.dataset.originalText;
      const isMatch = originalText.toLowerCase().includes(trimmedQuery);
      const content = item.querySelector(".accordion__content");
      const header = item.querySelector(".accordion__header");

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

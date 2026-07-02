import { createProject } from "./project.js";
import { addComment, createSubtask, createTask, setBlocked, updateDescription, updateStatus } from "./task.js";
import { getVaultRoot } from "./vault.js";

function seed(): void {
  const vaultRoot = getVaultRoot();

  const web = createProject(vaultRoot, "Website Redesign", {
    key: "WEB",
    labels: ["frontend", "backend", "design", "bug"],
  });

  const w1 = createTask(vaultRoot, web.slug, {
    title: "Настроить дизайн-систему",
    description: "Цвета, типографика, компоненты кнопок и форм на Tailwind.",
    priority: "high",
    labels: ["design"],
    order: 10,
  });
  updateStatus(vaultRoot, web.slug, w1.id, "done");
  addComment(vaultRoot, web.slug, w1.id, "Выглядит отлично, можно переходить дальше.", "human");

  const w2 = createTask(vaultRoot, web.slug, {
    title: "Собрать API аутентификации",
    description: "JWT, refresh-токены, middleware проверки сессии.",
    priority: "high",
    labels: ["backend"],
    order: 20,
  });
  updateStatus(vaultRoot, web.slug, w2.id, "done");

  const w3 = createTask(vaultRoot, web.slug, {
    title: "Вёрстка лендинга",
    description: "Главная страница по макету из Figma.",
    priority: "medium",
    labels: ["frontend"],
    order: 30,
  });
  updateStatus(vaultRoot, web.slug, w3.id, "in_review");
  updateDescription(
    vaultRoot,
    web.slug,
    w3.id,
    "Главная страница по макету из Figma. После ревью решили упростить hero-секцию — убрали видео-фон, оставили статичную картинку для скорости загрузки.",
    "Упростили hero-секцию: убрали видео-фон ради LCP, оставили статичное изображение."
  );
  addComment(vaultRoot, web.slug, w3.id, "Может всё-таки оставим видео, но сожмём сильнее?", "human");
  addComment(
    vaultRoot,
    web.slug,
    w3.id,
    "Проверил: даже сжатое видео даёт +1.2s к LCP на 4G. Предлагаю оставить статичную картинку.",
    "agent"
  );

  const w4 = createTask(vaultRoot, web.slug, {
    title: "Оптимизация производительности",
    description: "Разобраться, почему бандл разросся до 2МБ и LCP просел.",
    priority: "high",
    labels: ["backend", "bug"],
    order: 40,
  });
  updateStatus(vaultRoot, web.slug, w4.id, "in_progress");
  const w4a = createSubtask(vaultRoot, web.slug, w4.id, { title: "Профилировать бандл", order: 41 });
  updateStatus(vaultRoot, web.slug, w4a.id, "done");
  createSubtask(vaultRoot, web.slug, w4.id, { title: "Внедрить code-splitting по роутам", order: 42 });
  createSubtask(vaultRoot, web.slug, w4.id, { title: "Вынести аналитику в воркер", order: 43 });

  const w5 = createTask(vaultRoot, web.slug, {
    title: "Исправить баг с формой логина",
    description: "На Safari не проходит валидация email с плюсом в адресе.",
    priority: "urgent",
    labels: ["bug"],
    order: 50,
  });
  updateStatus(vaultRoot, web.slug, w5.id, "in_progress");
  setBlocked(vaultRoot, web.slug, w5.id, true);
  addComment(
    vaultRoot,
    web.slug,
    w5.id,
    "Баг в стороннем regex-пакете валидации email. Либо патчим его форк, либо меняем пакет целиком — второе затронет ещё 3 формы в проекте. Как предпочитаете?",
    "agent"
  );

  createTask(vaultRoot, web.slug, {
    title: "Написать e2e тесты для checkout",
    description: "Playwright, основные сценарии оплаты.",
    priority: "low",
    labels: ["backend"],
    order: 60,
  });

  createTask(vaultRoot, web.slug, {
    title: "Провести SEO-аудит",
    description: "Meta-теги, sitemap, скорость индексации.",
    priority: "medium",
    order: 70,
  });

  createTask(vaultRoot, web.slug, {
    title: "Добавить тёмную тему",
    description: "По системным настройкам + ручной переключатель.",
    priority: "low",
    labels: ["frontend"],
    order: 80,
  });

  const mobile = createProject(vaultRoot, "Mobile App", {
    key: "MOB",
    labels: ["ios", "android", "backend"],
  });

  const m1 = createTask(vaultRoot, mobile.slug, {
    title: "Настроить CI/CD",
    description: "Fastlane + автосборка на каждый PR.",
    priority: "high",
    order: 10,
  });
  updateStatus(vaultRoot, mobile.slug, m1.id, "in_progress");

  createTask(vaultRoot, mobile.slug, {
    title: "Экран онбординга",
    description: "3 слайда с объяснением ключевых функций.",
    priority: "medium",
    labels: ["ios", "android"],
    order: 20,
  });

  createTask(vaultRoot, mobile.slug, {
    title: "Push-уведомления",
    description: "Интеграция с APNs и FCM.",
    priority: "medium",
    labels: ["backend"],
    order: 30,
  });

  console.log(`Seeded projects "${web.name}" (${web.slug}) and "${mobile.name}" (${mobile.slug}) at ${vaultRoot}`);
}

seed();

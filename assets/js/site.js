/* Meu Pet Hoje — scripts compartilhados.
   Contatos centralizados aqui: altere uma vez e todos os botões acompanham. */
var MPH = {
  whatsapp: "13129897348",              // número do WhatsApp (DDI + número, só dígitos)
  email: "osd.negocios@gmail.com",
  appStore: "https://apps.apple.com/br/app/meu-pet-hoje/id6774032771",
  msgDemo: "Olá! Tenho um hotel/creche pet e quero agendar uma demonstração do Meu Pet Hoje.",
  msgFundador: "Olá! Quero saber mais sobre o programa de Parceiros Fundadores do Meu Pet Hoje."
};
function mphWa(text) { return "https://wa.me/" + MPH.whatsapp + "?text=" + encodeURIComponent(text); }

document.documentElement.classList.add("js");

(function () {
  // Links de WhatsApp: <a data-wa="demo|fundador|texto livre">
  document.querySelectorAll("[data-wa]").forEach(function (a) {
    var k = a.getAttribute("data-wa");
    var msg = k === "demo" ? MPH.msgDemo : k === "fundador" ? MPH.msgFundador : (k || MPH.msgDemo);
    a.href = mphWa(msg); a.target = "_blank"; a.rel = "noopener";
  });
  document.querySelectorAll("[data-email]").forEach(function (a) {
    a.href = "mailto:" + MPH.email + "?subject=" + encodeURIComponent(a.getAttribute("data-email") || "Meu Pet Hoje");
    if (!a.textContent.trim()) a.textContent = MPH.email;
  });
  document.querySelectorAll("[data-appstore]").forEach(function (a) { a.href = MPH.appStore; a.target = "_blank"; a.rel = "noopener"; });

  // Tema claro/escuro (padrão: sistema)
  var root = document.documentElement, tbtn = document.getElementById("themeBtn");
  try { var saved = localStorage.getItem("mph-theme"); if (saved) root.setAttribute("data-theme", saved); } catch (e) {}
  function isDark() { var t = root.getAttribute("data-theme"); return t === "dark" || (!t && matchMedia("(prefers-color-scheme: dark)").matches); }
  function syncTheme() { if (tbtn) tbtn.setAttribute("aria-label", isDark() ? "Usar tema claro" : "Usar tema escuro"); }
  if (tbtn) tbtn.addEventListener("click", function () {
    var next = isDark() ? "light" : "dark"; root.setAttribute("data-theme", next);
    try { localStorage.setItem("mph-theme", next); } catch (e) {}
    syncTheme();
  });
  syncTheme();

  // Menu mobile
  var mbtn = document.getElementById("menuBtn"), drawer = document.getElementById("drawer");
  if (mbtn && drawer) {
    mbtn.addEventListener("click", function () {
      var open = drawer.classList.toggle("open"); mbtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    drawer.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", function () { drawer.classList.remove("open"); mbtn.setAttribute("aria-expanded", "false"); }); });
  }

  // Borda no menu ao rolar
  var nav = document.getElementById("nav");
  if (nav) { var f = function () { nav.classList.toggle("scrolled", window.scrollY > 8); }; f(); addEventListener("scroll", f, { passive: true }); }

  // Animação de entrada
  var els = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }); }, { threshold: .12 });
    els.forEach(function (el) { io.observe(el); });
  } else { els.forEach(function (el) { el.classList.add("in"); }); }

  // Demonstração em etapas
  var demo = document.getElementById("demo");
  if (demo) {
    var tabs = demo.querySelectorAll("[role=tab]"), panes = demo.querySelectorAll(".demo-shot"), cur = 0, timer = null, userTook = false;
    function show(i) {
      cur = i;
      tabs.forEach(function (t, j) { t.setAttribute("aria-selected", j === i ? "true" : "false"); t.tabIndex = j === i ? 0 : -1; });
      panes.forEach(function (p, j) { p.classList.toggle("on", j === i); });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { userTook = true; clearInterval(timer); show(i); });
      t.addEventListener("keydown", function (e) {
        if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); userTook = true; clearInterval(timer); show((cur + 1) % tabs.length); tabs[cur].focus(); }
        if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); userTook = true; clearInterval(timer); show((cur - 1 + tabs.length) % tabs.length); tabs[cur].focus(); }
      });
    });
    var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce && "IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          clearInterval(timer);
          if (e.isIntersecting && !userTook) timer = setInterval(function () { show((cur + 1) % tabs.length); }, 4200);
        });
      }, { threshold: .4 }).observe(demo);
    }
    show(0);
  }

  // Formulário de interesse → abre o WhatsApp com a mensagem pronta (sem servidor)
  var form = document.getElementById("leadForm");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = function (n) { var el = form.elements[n]; return el ? String(el.value || "").trim() : ""; };
      var err = form.querySelector(".err");
      if (!v("nome") || !v("hotel") || !v("cidade")) { if (err) err.textContent = "Preencha seu nome, o nome do hotel e a cidade."; return; }
      if (err) err.textContent = "";
      var linhas = [
        "Olá! Quero participar do programa de Parceiros Fundadores do Meu Pet Hoje.",
        "",
        "Nome: " + v("nome"),
        "Hotel/creche: " + v("hotel"),
        "Cidade: " + v("cidade"),
        v("porte") ? "Pets por dia (média): " + v("porte") : "",
        v("tipo") ? "Tipo: " + v("tipo") : "",
        v("obs") ? "Observações: " + v("obs") : ""
      ].filter(function (l, i) { return l !== "" || i === 1; });
      window.open(mphWa(linhas.join("\n")), "_blank", "noopener");
      var ok = document.getElementById("leadOk"); if (ok) ok.hidden = false;
    });
  }

  var y = document.getElementById("year"); if (y) y.textContent = new Date().getFullYear();
})();

/* Vídeos com versão vertical no celular: troca a capa e recarrega ao cruzar o breakpoint */
(function () {
  var vids = document.querySelectorAll("video[data-poster-v]");
  if (!vids.length || !window.matchMedia) return;
  var mq = window.matchMedia("(max-width: 860px)");
  vids.forEach(function (v) { v.setAttribute("data-poster-h", v.getAttribute("poster")); });
  function sync() { vids.forEach(function (v) { v.poster = mq.matches ? v.getAttribute("data-poster-v") : v.getAttribute("data-poster-h"); }); }
  sync();
  var was = mq.matches;
  var onChange = function () { sync(); if (mq.matches === was) return; was = mq.matches; vids.forEach(function (v) { if (v.paused) v.load(); }); };
  if (mq.addEventListener) mq.addEventListener("change", onChange); else mq.addListener(onChange);
})();

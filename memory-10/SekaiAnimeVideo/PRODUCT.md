# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing Spring Boot 4.0.5 application with Thymeleaf templates, vanilla CSS, and browser JavaScript. The database layer is MySQL with MyBatis.

## Users

个人动漫爱好者。用户在多个看番、下载、漫画或音乐站点之间切换，需要一个私有的收藏入口来记住常用链接。

## Product Purpose

Sekai Anime 把分散的动漫站点整理成个人中转站。用户可以登录、收录站点、分类、搜索、收藏，并从看番页或聚合页快速打开外部资源。成功标准是用户能在几秒内找到想去的站点并开始观看。

## Positioning

产品的核心机制不是提供内容库，而是把用户自己的站点收藏、分类和跳转行为集中到一个轻量入口中，同时保留小窗和内嵌看番路径。

## Operating Context

用户通常在桌面浏览器中整理链接和打开外部站点，也会在移动设备上查看收藏。外部站点可能禁止 iframe 嵌入，因此产品必须保留弹窗或直接打开的恢复路径。

## Capabilities and Constraints

- Public routes: landing, login, and register.
- Authenticated routes: home, anime player, anime hub, and dashboard.
- Site records support a name, URL, description, comma-separated tags, category, click count, and active status.
- Forms and route names are already connected to controller methods and must remain compatible.
- The anime player uses proxied iframe URLs and offers mini-browser and full-screen overlay modes.
- No local image library, logo package, or frontend package manager exists in the project at the time of this record.
- External resource availability and iframe permissions are not controlled by this product.

## Brand Commitments

The product name is Sekai Anime. Existing copy and the database seed establish a Japanese animation and sakura context. The redesign may refine the expression, but must keep the product name, Chinese language, and personal anime-hub meaning recognizable.

## Evidence on Hand

Repository evidence: Thymeleaf templates under `src/main/resources/templates`, shared CSS and JavaScript under `src/main/resources/static`, controller routes in `PageControl`, and seeded categories and site data in `database/schema.sql`. No approved logo file, photography, illustration, testimonials, or analytics claims were found. Any generated visual must be treated as a product asset, not as factual proof.

## Product Principles

- Find the next watch quickly.
- Keep personal links organized without making the user maintain a complex system.
- Make external-site failures recoverable through direct or popup opening.
- Keep the experience calm enough for repeated browsing and focused enough for watching.

## Accessibility & Inclusion

Inferred baseline for this redesign: keyboard-accessible controls, visible focus states, readable contrast, responsive layouts, labels above form inputs, and reduced-motion fallbacks. No product-specific accessibility standard was supplied.

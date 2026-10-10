# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Spring Boot 4 + Thymeleaf + MyBatis + MySQL/H2. Existing codebase answers the stack choice.

## Users

根据 README、现有页面和路由推断，主要用户是需要检索、整理和维护二次元资料的站点成员。用户会在桌面或移动浏览器中浏览番剧、人物和台词，并在需要时录入或编辑数据。

## Product Purpose

Sekai Data Object 是二次元数据中心，集中管理番剧档案、人物图鉴、角色台词和台词原声音频。成功意味着用户可以在一个地方快速找到可靠条目，并完成必要的收录维护。

## Positioning

项目把番剧、人物、官方台词和原声音频放在同一个可搜索的数据关系中，台词条目不仅可读，也可以关联到角色、番剧、集数、时间点和音频文件。

## Operating Context

用户先登录，再从首页进入番剧、人物或台词库。列表页支持关键词或番剧筛选、分页和新增；番剧详情页聚合对应人物和台词，并允许编辑和删除。图片与音频可通过 URL 或本地上传维护。

## Capabilities and Constraints

- 已有路由：`/login`、`/register`、`/home`、`/series`、`/series/{id}`、`/characters`、`/quotes`。
- 已有统计：番剧数量、人物数量、台词数量、原声音频数量。
- 番剧字段包括官方名称、原名、类型、制作公司、首播日期、集数、评分、简介、封面、标签和官网。
- 人物字段包括所属番剧、官方姓名、原名、定位、声优、简介和立绘。
- 台词字段包括所属番剧、角色、原文、集数、时间点和原声音频。
- 音频支持 MP3、WAV、OGG、M4A、FLAC、AAC，单个文件最大 100MB。
- 现有表单字段、路由 slug 和服务端功能必须保持兼容。
- 页面需要在空数据、筛选无结果、服务端提示和上传/编辑状态下可用。

## Brand Commitments

项目名称为 Sekai Data Object，中文名为“二次元数据锡通”。现有素材和 README 将其定位为官方数据汇聚与本地托管的二次元资料中心。

## Evidence on Hand

- `README.md`：项目范围、数据规模、运行方式和功能说明。
- `src/main/resources/templates/`：现有页面结构和表单字段。
- `src/main/java/com/sekai/dataobject/`：控制器、服务和数据模型。
- `uploads/images/`：本地番剧封面和人物立绘资源。
- `uploads/quote-audio/`：台词原声音频上传目录（如存在）。
- 项目没有提供真实用户评价、客户 logo、商业指标或定价信息，页面不得编造这些内容。

## Product Principles

- 资料先于装饰，用户应先看到条目的实际内容。
- 关系清晰，番剧、人物、台词和音频之间的关联应一眼可见。
- 官方字段保持原貌，中文说明和原名并列呈现。
- 搜索、筛选、分页、上传和编辑都应保持直接反馈。
- 示例状态可以有设计感，但不伪造商业或数据事实。

## Accessibility & Inclusion

项目没有额外声明特定无障碍标准。页面按通用可访问性要求实现：表单字段有可见标签，键盘焦点清晰，按钮文本有足够对比度，动效尊重 `prefers-reduced-motion`，图片提供替代文本。

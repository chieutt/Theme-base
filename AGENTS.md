# Theme development workflow

## Branches

- Mặc định mọi công việc phát triển thực hiện trên nhánh `dev`.
- Trước khi sửa bất kỳ file nào, chạy `git status --short --branch` và `git remote -v`.
- Trước khi push, fetch và merge nhánh remote `dev` vào local `dev`. Không dùng `git reset`, force-push, hoặc bỏ lịch sử remote.
- Chỉ push hoặc merge `main` khi người dùng nói chính xác: `push main`.

## Shopify target

- Chỉ upload từ `dev` lên Shopify theme-base preview/unpublished:
  - Store: `orlune-theme.myshopify.com`
  - Theme ID: `183972528443`
  - Theme name: `theme-base`
  - Required role: `unpublished`
- Tuyệt đối không dùng theme live/published.
- Trước mọi lệnh Shopify CLI, chạy `shopify theme info` và xác nhận đúng ID, tên, và role ở trên.
- Sau QA, không được để `shopify theme dev` chạy. Trước khi đổi branch hoặc đổi preview, kiểm tra cổng `9292` và dừng watcher nếu còn chạy.

## Release: `push main`

Khi người dùng nói chính xác `push main`, bắt buộc thực hiện theo thứ tự:

1. Fetch cả `dev` và `main`.
2. Merge `main` vào `dev`.
3. Validate và push `dev` lên Shopify theme-base preview.
4. Fetch `main` lại.
5. Fast-forward `main` lên commit đã xác nhận của `dev`.
6. Fetch lần cuối, xác nhận `main` và `dev` cùng commit và divergence là `0 / 0`.

Không thay đổi theme live trong bất kỳ bước nào.

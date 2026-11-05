-- The shared product list is only for the extract-product function (service role).
insert into public.products (barcode, product_name) values ('5000169005224', 'Garden peas');
select tests.fails($$insert into public.products (barcode, product_name) values ('12ab', 'Bad')$$, 'check', 'barcodes must be 8 to 14 digits');

set role authenticated;
select tests.fails($$select * from public.products$$, 'permission denied', 'signed-in people cannot read the product list directly');
select tests.fails($$insert into public.products (barcode, product_name) values ('5000169005231', 'Fake')$$, 'permission denied', 'signed-in people cannot add to the product list');
set role anon;
select tests.fails($$select * from public.products$$, 'permission denied', 'signed-out visitors cannot read the product list');
reset role;

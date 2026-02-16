--
-- PostgreSQL database dump
--

\restrict Xa0H9Okm4V5frg39JUO5m7jVKl3hq9vKzVFA9WsxI4nP5SOgAYxPyBq3QuaWfDH

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.8 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.promotions DROP CONSTRAINT IF EXISTS promotions_product_id_fkey;
ALTER TABLE IF EXISTS ONLY public.promotions DROP CONSTRAINT IF EXISTS promotions_created_by_fkey;
ALTER TABLE IF EXISTS ONLY public.promotions DROP CONSTRAINT IF EXISTS promotions_category_id_fkey;
ALTER TABLE IF EXISTS ONLY public.promotions DROP CONSTRAINT IF EXISTS promotions_brand_id_fkey;
ALTER TABLE IF EXISTS ONLY public.promotion_usages DROP CONSTRAINT IF EXISTS promotion_usages_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.promotion_usages DROP CONSTRAINT IF EXISTS promotion_usages_promotion_id_fkey;
ALTER TABLE IF EXISTS ONLY public.promotion_usages DROP CONSTRAINT IF EXISTS promotion_usages_order_id_fkey;
ALTER TABLE IF EXISTS ONLY public.products DROP CONSTRAINT IF EXISTS products_category_id_fkey;
ALTER TABLE IF EXISTS ONLY public.products DROP CONSTRAINT IF EXISTS products_brand_id_fkey;
ALTER TABLE IF EXISTS ONLY public.orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.orders DROP CONSTRAINT IF EXISTS orders_promotion_id_fkey;
ALTER TABLE IF EXISTS ONLY public.order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE IF EXISTS ONLY public.order_items DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;
DROP INDEX IF EXISTS public.ix_users_email;
DROP INDEX IF EXISTS public.ix_products_name;
DROP INDEX IF EXISTS public.ix_categories_name;
DROP INDEX IF EXISTS public.ix_brands_name;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.promotions DROP CONSTRAINT IF EXISTS promotions_pkey;
ALTER TABLE IF EXISTS ONLY public.promotions DROP CONSTRAINT IF EXISTS promotions_code_key;
ALTER TABLE IF EXISTS ONLY public.promotion_usages DROP CONSTRAINT IF EXISTS promotion_usages_promotion_id_order_id_key;
ALTER TABLE IF EXISTS ONLY public.promotion_usages DROP CONSTRAINT IF EXISTS promotion_usages_pkey;
ALTER TABLE IF EXISTS ONLY public.products DROP CONSTRAINT IF EXISTS products_pkey;
ALTER TABLE IF EXISTS ONLY public.orders DROP CONSTRAINT IF EXISTS orders_pkey;
ALTER TABLE IF EXISTS ONLY public.order_items DROP CONSTRAINT IF EXISTS order_items_pkey;
ALTER TABLE IF EXISTS ONLY public.categories DROP CONSTRAINT IF EXISTS categories_pkey;
ALTER TABLE IF EXISTS ONLY public.brands DROP CONSTRAINT IF EXISTS brands_pkey;
ALTER TABLE IF EXISTS public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.promotions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.promotion_usages ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.products ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.orders ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.order_items ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.categories ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.brands ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.users_id_seq;
DROP TABLE IF EXISTS public.users;
DROP SEQUENCE IF EXISTS public.promotions_id_seq;
DROP TABLE IF EXISTS public.promotions;
DROP SEQUENCE IF EXISTS public.promotion_usages_id_seq;
DROP TABLE IF EXISTS public.promotion_usages;
DROP SEQUENCE IF EXISTS public.products_id_seq;
DROP TABLE IF EXISTS public.products;
DROP SEQUENCE IF EXISTS public.orders_id_seq;
DROP TABLE IF EXISTS public.orders;
DROP SEQUENCE IF EXISTS public.order_items_id_seq;
DROP TABLE IF EXISTS public.order_items;
DROP TABLE IF EXISTS public.categoriesduplicate;
DROP SEQUENCE IF EXISTS public.categories_id_seq;
DROP TABLE IF EXISTS public.categories;
DROP SEQUENCE IF EXISTS public.brands_id_seq;
DROP TABLE IF EXISTS public.brands;
DROP TYPE IF EXISTS public.userrole;
DROP TYPE IF EXISTS public.promotionscope;
DROP TYPE IF EXISTS public.productunit;
DROP TYPE IF EXISTS public.orderstatus;
DROP TYPE IF EXISTS public.discounttype;
--
-- Name: discounttype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.discounttype AS ENUM (
    'PERCENTAGE',
    'FIXED_AMOUNT'
);


--
-- Name: orderstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.orderstatus AS ENUM (
    'PENDING',
    'CONFIRMED',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED'
);


--
-- Name: productunit; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.productunit AS ENUM (
    'KG',
    'GRAM',
    'PIECE',
    'BUNCH',
    'DOZEN',
    'POUND'
);


--
-- Name: promotionscope; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.promotionscope AS ENUM (
    'GLOBAL',
    'CATEGORY',
    'BRAND',
    'PRODUCT'
);


--
-- Name: userrole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.userrole AS ENUM (
    'CUSTOMER',
    'STAFF',
    'ADMIN'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: brands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brands (
    name character varying(100) NOT NULL,
    description character varying,
    name_translations json,
    description_translations json,
    logo_url character varying(255),
    is_active boolean NOT NULL,
    id integer NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone
);


--
-- Name: brands_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.brands_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: brands_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.brands_id_seq OWNED BY public.brands.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    name character varying(100) NOT NULL,
    description character varying,
    name_translations json,
    description_translations json,
    image_url character varying(255),
    is_active boolean NOT NULL,
    id integer NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone
);


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: categoriesduplicate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categoriesduplicate (
    name character varying(100),
    description character varying,
    name_translations json,
    description_translations json,
    price double precision,
    unit public.productunit,
    stock_quantity integer,
    image_url character varying(255),
    is_organic boolean,
    is_active boolean,
    category_id integer,
    quantity_config json,
    id integer,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    brand_id integer
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    order_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity double precision NOT NULL,
    unit_price double precision NOT NULL,
    id integer NOT NULL,
    product_name character varying NOT NULL,
    product_unit character varying NOT NULL
);


--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    user_id integer NOT NULL,
    status public.orderstatus NOT NULL,
    shipping_address character varying NOT NULL,
    contact_phone character varying NOT NULL,
    total_amount double precision NOT NULL,
    id integer NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone,
    promotion_id integer,
    discount_amount numeric(10,2) DEFAULT 0,
    subtotal numeric(10,2)
);


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    name character varying(100) NOT NULL,
    description character varying,
    name_translations json,
    description_translations json,
    price double precision NOT NULL,
    unit public.productunit NOT NULL,
    stock_quantity integer NOT NULL,
    image_url character varying(255),
    is_organic boolean NOT NULL,
    is_active boolean NOT NULL,
    category_id integer NOT NULL,
    quantity_config json,
    id integer NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone,
    brand_id integer
);


--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: promotion_usages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotion_usages (
    id integer NOT NULL,
    promotion_id integer NOT NULL,
    order_id integer NOT NULL,
    user_id integer NOT NULL,
    discount_applied numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: promotion_usages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promotion_usages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promotion_usages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promotion_usages_id_seq OWNED BY public.promotion_usages.id;


--
-- Name: promotions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotions (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    code character varying(50),
    name_translations jsonb DEFAULT '{}'::jsonb,
    description_translations jsonb DEFAULT '{}'::jsonb,
    discount_type character varying(20) DEFAULT 'percentage'::character varying NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    scope character varying(20) DEFAULT 'global'::character varying NOT NULL,
    category_id integer,
    brand_id integer,
    product_id integer,
    min_order_amount numeric(10,2) DEFAULT 0,
    max_discount numeric(10,2),
    usage_limit integer,
    usage_count integer DEFAULT 0,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone NOT NULL,
    is_active boolean DEFAULT true,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone
);


--
-- Name: promotions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promotions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promotions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promotions_id_seq OWNED BY public.promotions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    email character varying NOT NULL,
    full_name character varying(100) NOT NULL,
    phone character varying(20),
    address character varying(200),
    role public.userrole NOT NULL,
    is_active boolean NOT NULL,
    id integer NOT NULL,
    hashed_password character varying NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: brands id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands ALTER COLUMN id SET DEFAULT nextval('public.brands_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: promotion_usages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usages ALTER COLUMN id SET DEFAULT nextval('public.promotion_usages_id_seq'::regclass);


--
-- Name: promotions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions ALTER COLUMN id SET DEFAULT nextval('public.promotions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: brands; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.brands (name, description, name_translations, description_translations, logo_url, is_active, id, created_at, updated_at) FROM stdin;
Sim	Trusted food brand	{"en": "Sim", "fr": "Sim", "ar": "\\u0633\\u064a\\u0645"}	{"en": "Trusted food brand", "fr": "Marque alimentaire de confiance", "ar": "\\u0639\\u0644\\u0627\\u0645\\u0629 \\u062a\\u062c\\u0627\\u0631\\u064a\\u0629 \\u063a\\u0630\\u0627\\u0626\\u064a\\u0629 \\u0645\\u0648\\u062b\\u0648\\u0642\\u0629"}	https://elsuq.s3.eu-west-3.amazonaws.com/product-brand/sim-logo.png	t	4	2026-02-13 11:10:09.331569	2026-02-13 11:31:27.183379
Cevital	Leading Algerian agro-food company	{"en": "Cevital", "fr": "Cevital", "ar": "\\u0633\\u064a\\u0641\\u064a\\u062a\\u0627\\u0644"}	{"en": "Leading Algerian agro-food company", "fr": "Entreprise agroalimentaire alg\\u00e9rienne leader", "ar": "\\u0634\\u0631\\u0643\\u0629 \\u062c\\u0632\\u0627\\u0626\\u0631\\u064a\\u0629 \\u0631\\u0627\\u0626\\u062f\\u0629 \\u0641\\u064a \\u0627\\u0644\\u0635\\u0646\\u0627\\u0639\\u0627\\u062a \\u0627\\u0644\\u063a\\u0630\\u0627\\u0626\\u064a\\u0629"}	https://elsuq.s3.eu-west-3.amazonaws.com/product-brand/cevital-logo.png	t	1	2026-02-13 11:10:07.313396	2026-02-13 11:34:40.408341
ElMordjene	"El Mordjene brand packaged food products	{"en": "ElMordjene", "fr": "ElMordjene", "ar": " \\u0627\\u0644\\u0645\\u0631\\u062c\\u0627\\u0646"}	{"en": "\\"El Mordjene brand packaged food products", "fr": "\\"Produits alimentaires emball\\u00e9s de la marque El Mordjene", "ar": "\\u0645\\u0646\\u062a\\u062c\\u0627\\u062a \\u063a\\u0630\\u0627\\u0626\\u064a\\u0629 \\u0645\\u0639\\u0628\\u0623\\u0629 \\u0645\\u0646 \\u0639\\u0644\\u0627\\u0645\\u0629  \\u0627\\u0644\\u0645\\u0631\\u062c\\u0627\\u0646"}	https://elsuq.s3.eu-west-3.amazonaws.com/product-brand/elmordjene-logo.png	t	7	2026-02-13 17:54:11.281988	2026-02-13 18:35:30.206537
Izdihar	Quality food products brand	{"en": "Izdihar", "fr": "Izdihar", "ar": "\\u0627\\u0632\\u062f\\u0647\\u0627\\u0631"}	{"en": "Quality food products brand", "fr": "Marque de produits alimentaires de qualit\\u00e9", "ar": "\\u0639\\u0644\\u0627\\u0645\\u0629 \\u062a\\u062c\\u0627\\u0631\\u064a\\u0629 \\u0644\\u0645\\u0646\\u062a\\u062c\\u0627\\u062a \\u063a\\u0630\\u0627\\u0626\\u064a\\u0629 \\u0639\\u0627\\u0644\\u064a\\u0629 \\u0627\\u0644\\u062c\\u0648\\u062f\\u0629"}	https://elsuq.s3.eu-west-3.amazonaws.com/product-brand/izdihar-logo.png	t	2	2026-02-13 11:10:07.893153	2026-02-13 11:35:24.680236
LaBelle	Premium food products	{"en": "LaBelle", "fr": "LaBelle", "ar": "\\u0644\\u0627\\u0628\\u064a\\u0644"}	{"en": "Premium food products", "fr": "Produits alimentaires haut de gamme", "ar": "\\u0645\\u0646\\u062a\\u062c\\u0627\\u062a \\u063a\\u0630\\u0627\\u0626\\u064a\\u0629 \\u0641\\u0627\\u062e\\u0631\\u0629"}	https://elsuq.s3.eu-west-3.amazonaws.com/product-brand/labelle-logo.png	t	3	2026-02-13 11:10:08.407639	2026-02-13 17:35:35.814057
Mama	Mama brand packaged food products	{"en": "Mama", "fr": "Mama", "ar": "\\u0645\\u0627\\u0645\\u0627"}	{"en": "Mama brand packaged food products", "fr": "Produits alimentaires emball\\u00e9s de la marque Mama", "ar": "\\u0645\\u0646\\u062a\\u062c\\u0627\\u062a \\u063a\\u0630\\u0627\\u0626\\u064a\\u0629 \\u0645\\u0639\\u0628\\u0623\\u0629 \\u0645\\u0646 \\u0639\\u0644\\u0627\\u0645\\u0629 \\u0645\\u0627\\u0645\\u0627"}	https://elsuq.s3.eu-west-3.amazonaws.com/product-brand/mama-logo.png	t	5	2026-02-13 17:48:01.087432	\N
1001	1001 brand packaged food products	{"en": "1001", "fr": "1001", "ar": "1001"}	{"en": "1001 brand packaged food products", "fr": "Produits alimentaires emball\\u00e9s de la marque 1001", "ar": "\\u0645\\u0646\\u062a\\u062c\\u0627\\u062a \\u063a\\u0630\\u0627\\u0626\\u064a\\u0629 \\u0645\\u0639\\u0628\\u0623\\u0629 \\u0645\\u0646 \\u0639\\u0644\\u0627\\u0645\\u0629 1001"}	https://elsuq.s3.eu-west-3.amazonaws.com/product-brand/1001-logo.png	t	6	2026-02-13 17:50:47.677422	\N
Bimo	Bimo brand packaged snack and biscuit products	{"en": "Bimo", "fr": "Bimo", "ar": "\\u0628\\u064a\\u0645\\u0648"}	{"en": "Bimo brand packaged snack and biscuit products", "fr": "Produits de snacks et biscuits emball\\u00e9s de la marque Bimo", "ar": "\\u0645\\u0646\\u062a\\u062c\\u0627\\u062a \\u0627\\u0644\\u0648\\u062c\\u0628\\u0627\\u062a \\u0627\\u0644\\u062e\\u0641\\u064a\\u0641\\u0629 \\u0648\\u0627\\u0644\\u0628\\u0633\\u0643\\u0648\\u064a\\u062a \\u0627\\u0644\\u0645\\u0639\\u0628\\u0623\\u0629 \\u0645\\u0646 \\u0639\\u0644\\u0627\\u0645\\u0629 \\u0628\\u064a\\u0645\\u0648   "}	https://elsuq.s3.eu-west-3.amazonaws.com/product-brand/bimo-logos.png	t	13	2026-02-16 13:13:32.856281	\N
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categories (name, description, name_translations, description_translations, image_url, is_active, id, created_at, updated_at) FROM stdin;
Fresh Vegetables	Fresh and seasonal vegetables	{"en": "Fresh Vegetables", "fr": "L\\u00e9gumes Frais", "ar": "\\u062e\\u0636\\u0631\\u0648\\u0627\\u062a \\u0637\\u0627\\u0632\\u062c\\u0629"}	{"en": "Fresh and seasonal vegetables", "fr": "L\\u00e9gumes frais et de saison", "ar": "\\u062e\\u0636\\u0631\\u0648\\u0627\\u062a \\u0637\\u0627\\u0632\\u062c\\u0629 \\u0648\\u0645\\u0648\\u0633\\u0645\\u064a\\u0629"}	https://images.unsplash.com/photo-1518843875459-f738682238a6?auto=format&fit=crop&w=1442&q=80	f	2	2026-01-21 11:26:07.444353	2026-02-11 13:53:40.738965
Organic Produce	Certified organic fruits and vegetables	{"en": "Organic Produce", "fr": "Produits Bio", "ar": "\\u0645\\u0646\\u062a\\u062c\\u0627\\u062a \\u0639\\u0636\\u0648\\u064a\\u0629"}	{"en": "Certified organic fruits and vegetables", "fr": "Fruits et l\\u00e9gumes bio certifi\\u00e9s", "ar": "\\u0641\\u0648\\u0627\\u0643\\u0647 \\u0648\\u062e\\u0636\\u0631\\u0648\\u0627\\u062a \\u0639\\u0636\\u0648\\u064a\\u0629 \\u0645\\u0639\\u062a\\u0645\\u062f\\u0629"}	https://images.unsplash.com/photo-1576675466969-38eeae4b41f6?auto=format&fit=crop&w=1442&q=80	f	3	2026-01-21 11:26:07.831442	2026-02-11 13:53:49.985926
Fresh Fruits	Fresh and seasonal fruits	{"en": "Fresh Fruits", "fr": "Fruits Frais", "ar": "\\u0641\\u0648\\u0627\\u0643\\u0647 \\u0637\\u0627\\u0632\\u062c\\u0629"}	{"en": "Fresh and seasonal fruits", "fr": "Fruits frais et de saison", "ar": "\\u0641\\u0648\\u0627\\u0643\\u0647 \\u0637\\u0627\\u0632\\u062c\\u0629 \\u0648\\u0645\\u0648\\u0633\\u0645\\u064a\\u0629"}	https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=1470&q=80	f	1	2026-01-21 11:26:07.077131	2026-02-13 11:35:45.724234
Biscuits	Packaged biscuit and cookie products	{"en": "Biscuits", "fr": "Biscuits", "ar": "\\u0628\\u0633\\u0643\\u0648\\u064a\\u062a"}	{"en": "Packaged biscuit and cookie products", "fr": "Produits de biscuits et cookies emball\\u00e9s", "ar": "\\u0645\\u0646\\u062a\\u062c\\u0627\\u062a \\u0627\\u0644\\u0628\\u0633\\u0643\\u0648\\u064a\\u062a \\u0627\\u0644\\u0645\\u0639\\u0628\\u0623\\u0629"}	https://elsuq.s3.eu-west-3.amazonaws.com/product-category/biscuits-logos.png	t	14	2026-02-13 11:49:55.851761	2026-02-13 11:58:47.833906
Dried Legumes	Dried legumes such as lentils, chickpeas, and beans	{"en": "Dried Legumes", "fr": "L\\u00e9gumes secs", "ar": "\\u0628\\u0642\\u0648\\u0644 \\u062c\\u0627\\u0641\\u0629"}	{"en": "Dried legumes such as lentils, chickpeas, and beans", "fr": "L\\u00e9gumes secs comme les lentilles, pois chiches et haricots", "ar": "\\u0628\\u0642\\u0648\\u0644 \\u062c\\u0627\\u0641\\u0629 \\u0645\\u062b\\u0644 \\u0627\\u0644\\u0639\\u062f\\u0633 \\u0648\\u0627\\u0644\\u062d\\u0645\\u0635 \\u0648\\u0627\\u0644\\u0641\\u0627\\u0635\\u0648\\u0644\\u064a\\u0627\\u0621"}	https://elsuq.s3.eu-west-3.amazonaws.com/product-brand/legumes_secs.png	f	4	2026-01-31 14:12:59.194143	2026-02-13 11:36:29.95151
Pasta	Packaged pasta products	{"en": "Pasta", "fr": "P\\u00e2tes", "ar": "\\u0645\\u0639\\u0643\\u0631\\u0648\\u0646\\u0629"}	{"en": "Packaged pasta products", "fr": "Produits de p\\u00e2tes emball\\u00e9s", "ar": "\\u0645\\u0646\\u062a\\u062c\\u0627\\u062a \\u0627\\u0644\\u0645\\u0639\\u0643\\u0631\\u0648\\u0646\\u0629 \\u0627\\u0644\\u0645\\u0639\\u0628\\u0623\\u0629"}	https://elsuq.s3.eu-west-3.amazonaws.com/product-category/pates-logos.png	t	15	2026-02-13 11:55:41.667963	2026-02-13 11:56:49.753793
Flour	Packaged flour products for baking and cooking	{"en": "Flour", "fr": "Farine", "ar": "\\u062f\\u0642\\u064a\\u0642"}	{"en": "Packaged flour products for baking and cooking", "fr": "Produits de farine emball\\u00e9s pour la p\\u00e2tisserie et la cuisine", "ar": "\\u0645\\u0646\\u062a\\u062c\\u0627\\u062a \\u0627\\u0644\\u062f\\u0642\\u064a\\u0642 \\u0627\\u0644\\u0645\\u0639\\u0628\\u0623\\u0629 \\u0644\\u0644\\u062e\\u0628\\u0632 \\u0648\\u0627\\u0644\\u0637\\u0628\\u062e"}	https://elsuq.s3.eu-west-3.amazonaws.com/product-category/farine-logos.png	t	13	2026-02-13 11:47:24.102063	2026-02-13 11:58:14.625043
Sugar	Packaged sugar products	{"en": "Sugar", "fr": "Sucre", "ar": "\\u0633\\u0643\\u0631"}	{"en": "Packaged sugar products", "fr": "Produits de sucre emball\\u00e9s", "ar": "\\u0645\\u0646\\u062a\\u062c\\u0627\\u062a \\u0627\\u0644\\u0633\\u0643\\u0631 \\u0627\\u0644\\u0645\\u0639\\u0628\\u0623\\u0629"}	https://elsuq.s3.eu-west-3.amazonaws.com/product-category/sucre-logos.png	t	12	2026-02-13 11:45:55.922913	2026-02-13 11:59:17.309029
Coffee	Ground and packaged coffee products	{"en": "Coffee", "fr": "Caf\\u00e9", "ar": "\\u0642\\u0647\\u0648\\u0629"}	{"en": "Ground and packaged coffee products", "fr": "Produits de caf\\u00e9 moulu et emball\\u00e9", "ar": "\\u0645\\u0646\\u062a\\u062c\\u0627\\u062a \\u0627\\u0644\\u0642\\u0647\\u0648\\u0629 \\u0627\\u0644\\u0645\\u0637\\u062d\\u0648\\u0646\\u0629 \\u0648\\u0627\\u0644\\u0645\\u0639\\u0628\\u0623\\u0629"}	https://elsuq.s3.eu-west-3.amazonaws.com/product-category/cafe-logos.png	t	11	2026-02-13 11:44:08.829111	2026-02-13 11:59:47.208152
Gaufrette	Packaged wafer and snack products	{"en": "Gaufrette", "fr": "Gaufrette", "ar": "\\u0648\\u064a\\u0641\\u0631"}	{"en": "Packaged wafer and snack products", "fr": "Produits de gaufrettes et snacks emball\\u00e9s", "ar": "\\u0645\\u0646\\u062a\\u062c\\u0627\\u062a \\u0627\\u0644\\u0648\\u064a\\u0641\\u0631 \\u0648\\u0627\\u0644\\u0648\\u062c\\u0628\\u0627\\u062a \\u0627\\u0644\\u062e\\u0641\\u064a\\u0641\\u0629 \\u0627\\u0644\\u0645\\u0639\\u0628\\u0623\\u0629\\n   "}	https://elsuq.s3.eu-west-3.amazonaws.com/product-category/gaufrette-logo.png	t	16	2026-02-13 12:03:55.93852	2026-02-13 12:04:50.297848
Tomato Paste 	Rich and thick tomato paste made from sun-ripened tomatoes, adding intense flavor and vibrant color to your sauces, stews, and traditional recipes.	{"en": "Tomato Paste ", "fr": "Concentr\\u00e9 de Tomate", "ar": "\\u0645\\u0639\\u062c\\u0648\\u0646 \\u0637\\u0645\\u0627\\u0637\\u0645"}	{"en": "Rich and thick tomato paste made from sun-ripened tomatoes, adding intense flavor and vibrant color to your sauces, stews, and traditional recipes.", "fr": "Concentr\\u00e9 de tomate riche et \\u00e9pais, \\u00e9labor\\u00e9 \\u00e0 partir de tomates m\\u00fbries au soleil pour apporter une saveur intense et une belle couleur \\u00e0 vos sauces, plats mijot\\u00e9s et recettes traditionnelles.", "ar": "\\u0645\\u0639\\u062c\\u0648\\u0646 \\u0637\\u0645\\u0627\\u0637\\u0645 \\u063a\\u0646\\u064a \\u0648\\u0633\\u0645\\u064a\\u0643 \\u0645\\u0635\\u0646\\u0648\\u0639 \\u0645\\u0646 \\u0637\\u0645\\u0627\\u0637\\u0645 \\u0646\\u0627\\u0636\\u062c\\u0629 \\u062a\\u062d\\u062a \\u0623\\u0634\\u0639\\u0629 \\u0627\\u0644\\u0634\\u0645\\u0633\\u060c \\u064a\\u0645\\u0646\\u062d \\u0646\\u0643\\u0647\\u0629 \\u0642\\u0648\\u064a\\u0629 \\u0648\\u0644\\u0648\\u0646\\u0627\\u064b \\u062c\\u0645\\u064a\\u0644\\u0627\\u064b \\u0644\\u0644\\u0635\\u0644\\u0635\\u0627\\u062a \\u0648\\u0627\\u0644\\u0623\\u0637\\u0628\\u0627\\u0642 \\u0627\\u0644\\u062a\\u0642\\u0644\\u064a\\u062f\\u064a\\u0629."}	https://elsuq.s3.eu-west-3.amazonaws.com/product-category/tomate-logos.png	t	17	2026-02-13 13:48:52.630689	\N
Jams	Packaged jam and fruit preserve products	{"en": "Jams", "fr": "Confiture", "ar": "\\u0645\\u0631\\u0628\\u0649"}	{"en": "Packaged jam and fruit preserve products", "fr": "Produits de confiture et conserves de fruits emball\\u00e9s.", "ar": "\\u0645\\u0646\\u062a\\u062c\\u0627\\u062a \\u0627\\u0644\\u0645\\u0631\\u0628\\u0649 \\u0648\\u0645\\u0639\\u0644\\u0628\\u0627\\u062a \\u0627\\u0644\\u0641\\u0648\\u0627\\u0643\\u0647 \\u0627\\u0644\\u0645\\u0639\\u0628\\u0623\\u0629"}	https://elsuq.s3.eu-west-3.amazonaws.com/product-category/confiture-logo.png	t	18	2026-02-13 15:19:51.962807	2026-02-13 15:25:43.980341
Harissa	Packaged harissa and chili paste products	{"en": "Harissa", "fr": "Harissa", "ar": "\\u0647\\u0631\\u064a\\u0633\\u0629"}	{"en": "Packaged harissa and chili paste products", "fr": "Produits de harissa et de p\\u00e2te de piment emball\\u00e9s", "ar": "\\u0645\\u0646\\u062a\\u062c\\u0627\\u062a \\u0627\\u0644\\u0647\\u0631\\u064a\\u0633\\u0629 \\u0648\\u0645\\u0639\\u062c\\u0648\\u0646 \\u0627\\u0644\\u0641\\u0644\\u0641\\u0644 \\u0627\\u0644\\u0645\\u0639\\u0628\\u0623\\u0629"}	https://elsuq.s3.eu-west-3.amazonaws.com/product-category/harissa-logo.png	t	19	2026-02-13 16:29:01.813975	\N
Oil	Packaged cooking oil products	{"en": "Oil", "fr": "Huile", "ar": "\\u0632\\u064a\\u062a"}	{"en": "Packaged cooking oil products", "fr": "Produits d'huile de cuisson emball\\u00e9s", "ar": "\\u0645\\u0646\\u062a\\u062c\\u0627\\u062a \\u0632\\u064a\\u062a \\u0627\\u0644\\u0637\\u0647\\u064a \\u0627\\u0644\\u0645\\u0639\\u0628\\u0623\\u0629"}	https://elsuq.s3.eu-west-3.amazonaws.com/product-category/huiles-logo.png	t	21	2026-02-15 11:44:20.222838	\N
\.


--
-- Data for Name: categoriesduplicate; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categoriesduplicate (name, description, name_translations, description_translations, price, unit, stock_quantity, image_url, is_organic, is_active, category_id, quantity_config, id, created_at, updated_at, brand_id) FROM stdin;
Dates	Naturally sweet dates. Great for energy snacks and desserts.	{"en": "Dates", "fr": "Dattes", "ar": "\\u062a\\u0645\\u0631"}	{"en": "Naturally sweet dates. Great for energy snacks and desserts.", "fr": "Dattes naturellement sucr\\u00e9es. Parfaites pour les collations \\u00e9nerg\\u00e9tiques et les desserts.", "ar": "\\u062a\\u0645\\u0631 \\u062d\\u0644\\u0648 \\u0637\\u0628\\u064a\\u0639\\u064a. \\u0631\\u0627\\u0626\\u0639 \\u0644\\u0644\\u0648\\u062c\\u0628\\u0627\\u062a \\u0627\\u0644\\u062e\\u0641\\u064a\\u0641\\u0629 \\u0648\\u0627\\u0644\\u0637\\u0627\\u0642\\u0629 \\u0648\\u0627\\u0644\\u062d\\u0644\\u0648\\u064a\\u0627\\u062a."}	35	KG	400	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/date.png	f	t	1	{"type": "range", "min": 5, "max": 400, "step": 5, "pills": [10, 25, 50]}	4	2026-01-21 11:26:10.927796	\N	\N
Nectarines	Juicy nectarines with a smooth skin. Great fresh or in desserts.	{"en": "Nectarines", "fr": "Nectarines", "ar": "\\u0646\\u0643\\u062a\\u0627\\u0631\\u064a\\u0646"}	{"en": "Juicy nectarines with a smooth skin. Great fresh or in desserts.", "fr": "Nectarines juteuses \\u00e0 peau lisse. Excellentes fra\\u00eeches ou en dessert.", "ar": "\\u0646\\u0643\\u062a\\u0627\\u0631\\u064a\\u0646 \\u0639\\u0635\\u064a\\u0631 \\u0628\\u0642\\u0634\\u0631\\u0629 \\u0646\\u0627\\u0639\\u0645\\u0629. \\u0645\\u0645\\u062a\\u0627\\u0632 \\u0637\\u0627\\u0632\\u062c\\u0627\\u064b \\u0623\\u0648 \\u0641\\u064a \\u0627\\u0644\\u062d\\u0644\\u0648\\u064a\\u0627\\u062a."}	600	KG	500	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/nictarine.png	f	t	1	{"type": "range", "min": 5, "max": 500, "step": 5, "pills": [10, 25, 50]}	6	2026-01-21 11:26:12.545579	\N	\N
Oranges	Juicy oranges rich in vitamin C. Great for fresh juice or snacking.	{"en": "Oranges", "fr": "Oranges", "ar": "\\u0628\\u0631\\u062a\\u0642\\u0627\\u0644"}	{"en": "Juicy oranges rich in vitamin C. Great for fresh juice or snacking.", "fr": "Oranges juteuses riches en vitamine C. Parfaites en jus ou \\u00e0 grignoter.", "ar": "\\u0628\\u0631\\u062a\\u0642\\u0627\\u0644 \\u0639\\u0635\\u064a\\u0631 \\u063a\\u0646\\u064a \\u0628\\u0641\\u064a\\u062a\\u0627\\u0645\\u064a\\u0646 \\u0633\\u064a. \\u0631\\u0627\\u0626\\u0639 \\u0644\\u0644\\u0639\\u0635\\u064a\\u0631 \\u0623\\u0648 \\u0627\\u0644\\u0648\\u062c\\u0628\\u0627\\u062a \\u0627\\u0644\\u062e\\u0641\\u064a\\u0641\\u0629."}	100	KG	600	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/orange.png	f	t	1	{"type": "range", "min": 10, "max": 600, "step": 10, "pills": [30, 60, 100]}	7	2026-01-21 11:26:14.866451	\N	\N
Peaches	Sweet, fragrant peaches. Delicious fresh or in desserts.	{"en": "Peaches", "fr": "P\\u00eaches", "ar": "\\u062e\\u0648\\u062e"}	{"en": "Sweet, fragrant peaches. Delicious fresh or in desserts.", "fr": "P\\u00eaches sucr\\u00e9es et parfum\\u00e9es. D\\u00e9licieuses fra\\u00eeches ou en dessert.", "ar": "\\u062e\\u0648\\u062e \\u062d\\u0644\\u0648 \\u0648\\u0645\\u0639\\u0637\\u0631. \\u0644\\u0630\\u064a\\u0630 \\u0637\\u0627\\u0632\\u062c\\u0627\\u064b \\u0623\\u0648 \\u0641\\u064a \\u0627\\u0644\\u062d\\u0644\\u0648\\u064a\\u0627\\u062a."}	350	KG	5000	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/peche.png	f	t	1	{"type": "range", "min": 5, "max": 300, "step": 5, "pills": [10, 25, 50]}	8	2026-01-21 11:26:15.667479	\N	\N
Pears	Sweet and juicy pears with a delicate flavor. Great for snacking.	{"en": "Pears", "fr": "Poires", "ar": "\\u0643\\u0645\\u062b\\u0631\\u0649"}	{"en": "Sweet and juicy pears with a delicate flavor. Great for snacking.", "fr": "Poires sucr\\u00e9es et juteuses au go\\u00fbt d\\u00e9licat. Parfaites pour grignoter.", "ar": "\\u0643\\u0645\\u062b\\u0631\\u0649 \\u062d\\u0644\\u0648\\u0629 \\u0648\\u0639\\u0635\\u064a\\u0631\\u064a\\u0629 \\u0628\\u0646\\u0643\\u0647\\u0629 \\u0644\\u0637\\u064a\\u0641\\u0629. \\u0645\\u062b\\u0627\\u0644\\u064a\\u0629 \\u0644\\u0644\\u0648\\u062c\\u0628\\u0627\\u062a \\u0627\\u0644\\u062e\\u0641\\u064a\\u0641\\u0629."}	550	KG	600	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/poire.png	f	t	1	{"type": "range", "min": 5, "max": 500, "step": 5, "pills": [10, 25, 50]}	9	2026-01-21 11:26:16.377141	\N	\N
Clementines	Seedless clementines, sweet and juicy. Perfect for snacking.	{"en": "Clementines", "fr": "Cl\\u00e9mentines", "ar": "\\u0643\\u0644\\u064a\\u0645\\u0646\\u062a\\u064a\\u0646"}	{"en": "Seedless clementines, sweet and juicy. Perfect for snacking.", "fr": "Cl\\u00e9mentines sans p\\u00e9pins, sucr\\u00e9es et juteuses. Parfaites pour les collations.", "ar": "\\u0643\\u0644\\u064a\\u0645\\u0646\\u062a\\u064a\\u0646 \\u0628\\u062f\\u0648\\u0646 \\u0628\\u0630\\u0648\\u0631\\u060c \\u062d\\u0644\\u0648 \\u0648\\u0639\\u0635\\u064a\\u0631. \\u0645\\u062b\\u0627\\u0644\\u064a \\u0644\\u0644\\u0648\\u062c\\u0628\\u0627\\u062a \\u0627\\u0644\\u062e\\u0641\\u064a\\u0641\\u0629."}	170	KG	940	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/climentine.png	f	t	1	{"type": "range", "min": 10, "max": 1000, "step": 10, "pills": [20, 50, 100]}	3	2026-01-21 11:26:10.027558	\N	\N
Yellow Lemons	Fresh yellow lemons with a tart flavor. Perfect for cooking and drinks.	{"en": "Yellow Lemons", "fr": "Citrons jaunes", "ar": "\\u0644\\u064a\\u0645\\u0648\\u0646 \\u0623\\u0635\\u0641\\u0631"}	{"en": "Fresh yellow lemons with a tart flavor. Perfect for cooking and drinks.", "fr": "Citrons jaunes frais avec une saveur acidul\\u00e9e. Parfaits pour la cuisine et les boissons.", "ar": "\\u0644\\u064a\\u0645\\u0648\\u0646 \\u0623\\u0635\\u0641\\u0631 \\u0637\\u0627\\u0632\\u062c \\u0628\\u0646\\u0643\\u0647\\u0629 \\u062d\\u0627\\u0645\\u0636\\u0629. \\u0645\\u062b\\u0627\\u0644\\u064a \\u0644\\u0644\\u0637\\u0628\\u062e \\u0648\\u0627\\u0644\\u0645\\u0634\\u0631\\u0648\\u0628\\u0627\\u062a."}	220	KG	475	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/citron-jaune.png	f	t	1	{"type": "range", "min": 5, "max": 500, "step": 5, "pills": [10, 25, 50]}	5	2026-01-21 11:26:11.503663	\N	\N
Yellow Apples	Crisp yellow apples with a balanced sweet flavor. Great for snacking.	{"en": "Yellow Apples", "fr": "Pommes jaunes", "ar": "\\u062a\\u0641\\u0627\\u062d \\u0623\\u0635\\u0641\\u0631"}	{"en": "Crisp yellow apples with a balanced sweet flavor. Great for snacking.", "fr": "Pommes jaunes croquantes au go\\u00fbt sucr\\u00e9 \\u00e9quilibr\\u00e9. Parfaites pour grignoter.", "ar": "\\u062a\\u0641\\u0627\\u062d \\u0623\\u0635\\u0641\\u0631 \\u0645\\u0642\\u0631\\u0645\\u0634 \\u0628\\u0646\\u0643\\u0647\\u0629 \\u062d\\u0644\\u0648\\u0629 \\u0645\\u062a\\u0648\\u0627\\u0632\\u0646\\u0629. \\u0645\\u062b\\u0627\\u0644\\u064a \\u0644\\u0644\\u0648\\u062c\\u0628\\u0627\\u062a \\u0627\\u0644\\u062e\\u0641\\u064a\\u0641\\u0629."}	420	KG	500	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/pomme-jaune.png	f	t	1	{"type": "range", "min": 5, "max": 200, "step": 5, "pills": [20, 50, 100]}	10	2026-01-21 11:26:17.174359	\N	\N
Red Apples	Fresh, crisp red apples. Great for snacking, baking, or cooking.	{"en": "Red Apples", "fr": "Pommes rouges", "ar": "\\u062a\\u0641\\u0627\\u062d \\u0623\\u062d\\u0645\\u0631"}	{"en": "Fresh, crisp red apples. Great for snacking, baking, or cooking.", "fr": "Pommes rouges fra\\u00eeches et croquantes. Parfaites pour les collations, la p\\u00e2tisserie ou la cuisine.", "ar": "\\u062a\\u0641\\u0627\\u062d \\u0623\\u062d\\u0645\\u0631 \\u0637\\u0627\\u0632\\u062c \\u0648\\u0645\\u0642\\u0631\\u0645\\u0634. \\u0645\\u062b\\u0627\\u0644\\u064a \\u0644\\u0644\\u0648\\u062c\\u0628\\u0627\\u062a \\u0627\\u0644\\u062e\\u0641\\u064a\\u0641\\u0629 \\u0623\\u0648 \\u0627\\u0644\\u0637\\u0628\\u062e \\u0623\\u0648 \\u0627\\u0644\\u062e\\u0628\\u0632."}	500	KG	500	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/pomme-rouge.png	f	t	1	{"type": "range", "min": 5, "max": 200, "step": 5, "pills": [20, 50, 100]}	11	2026-01-21 11:26:17.922709	\N	\N
Swiss Chard	Fresh swiss chard with tender leaves and stems. Great sautéed or in soups.	{"en": "Swiss Chard", "fr": "Carde", "ar": "\\u0633\\u0644\\u0642"}	{"en": "Fresh swiss chard with tender leaves and stems. Great saut\\u00e9ed or in soups.", "fr": "Carde fra\\u00eeche avec feuilles et tiges tendres. D\\u00e9licieuse saut\\u00e9e ou en soupe.", "ar": "\\u0633\\u0644\\u0642 \\u0637\\u0627\\u0632\\u062c \\u0628\\u0623\\u0648\\u0631\\u0627\\u0642 \\u0648\\u0633\\u064a\\u0642\\u0627\\u0646 \\u0637\\u0631\\u064a\\u0629. \\u0645\\u0645\\u062a\\u0627\\u0632 \\u0645\\u0642\\u0644\\u064a\\u0627\\u064b \\u0623\\u0648 \\u0641\\u064a \\u0627\\u0644\\u0634\\u0648\\u0631\\u0628\\u0627\\u062a."}	110	BUNCH	500	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/carde.png	f	t	2	{"type": "list", "quantities": [5, 10, 20, 30, 50, 100]}	16	2026-01-21 11:26:21.735946	\N	\N
Celery	Crisp celery stalks. Perfect for soups, salads, and healthy snacking.	{"en": "Celery", "fr": "C\\u00e9leri", "ar": "\\u0643\\u0631\\u0641\\u0633"}	{"en": "Crisp celery stalks. Perfect for soups, salads, and healthy snacking.", "fr": "Branches de c\\u00e9leri croquantes. Parfaites pour soupes, salades et collations saines.", "ar": "\\u0633\\u064a\\u0642\\u0627\\u0646 \\u0643\\u0631\\u0641\\u0633 \\u0645\\u0642\\u0631\\u0645\\u0634\\u0629. \\u0645\\u062b\\u0627\\u0644\\u064a\\u0629 \\u0644\\u0644\\u0634\\u0648\\u0631\\u0628\\u0627\\u062a \\u0648\\u0627\\u0644\\u0633\\u0644\\u0637\\u0627\\u062a \\u0648\\u0627\\u0644\\u0648\\u062c\\u0628\\u0627\\u062a \\u0627\\u0644\\u062e\\u0641\\u064a\\u0641\\u0629 \\u0627\\u0644\\u0635\\u062d\\u064a\\u0629."}	80	BUNCH	55	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/celery.png	f	t	2	{"type": "list", "quantities": [5, 10, 20, 40, 80, 100]}	18	2026-01-21 11:26:23.135891	\N	\N
Eggplants	Fresh eggplants with a mild flavor. Perfect for grilling, roasting, and stews.	{"en": "Eggplants", "fr": "Aubergines", "ar": "\\u0628\\u0627\\u0630\\u0646\\u062c\\u0627\\u0646"}	{"en": "Fresh eggplants with a mild flavor. Perfect for grilling, roasting, and stews.", "fr": "Aubergines fra\\u00eeches au go\\u00fbt doux. Parfaites pour griller, r\\u00f4tir et mijoter.", "ar": "\\u0628\\u0627\\u0630\\u0646\\u062c\\u0627\\u0646 \\u0637\\u0627\\u0632\\u062c \\u0628\\u0646\\u0643\\u0647\\u0629 \\u062e\\u0641\\u064a\\u0641\\u0629. \\u0645\\u062b\\u0627\\u0644\\u064a \\u0644\\u0644\\u0634\\u0648\\u0627\\u0621 \\u0648\\u0627\\u0644\\u062a\\u062d\\u0645\\u064a\\u0631 \\u0648\\u0627\\u0644\\u064a\\u062e\\u0646\\u0627\\u062a."}	180	KG	200	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/aubergine.png	f	t	2	{"type": "range", "min": 5, "max": 330, "step": 5, "pills": [10, 25, 50]}	13	2026-01-21 11:26:19.455953	2026-02-08 22:06:15.726953	\N
Artichokes	Fresh artichokes with tender hearts. A Mediterranean delicacy.	{"en": "Artichokes", "fr": "Artichauts", "ar": "\\u062e\\u0631\\u0634\\u0648\\u0641"}	{"en": "Fresh artichokes with tender hearts. A Mediterranean delicacy.", "fr": "Artichauts frais avec des c\\u0153urs tendres. Une d\\u00e9licatesse m\\u00e9diterran\\u00e9enne.", "ar": "\\u062e\\u0631\\u0634\\u0648\\u0641 \\u0637\\u0627\\u0632\\u062c \\u0628\\u0642\\u0644\\u0648\\u0628 \\u0637\\u0631\\u064a\\u0629. \\u0645\\u0646 \\u0623\\u0644\\u0630\\u0651 \\u0623\\u0637\\u0628\\u0627\\u0642 \\u0627\\u0644\\u0628\\u062d\\u0631 \\u0627\\u0644\\u0645\\u062a\\u0648\\u0633\\u0637."}	220	KG	55	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/artichaut.png	f	t	2	{"type": "range", "min": 5, "max": 300, "step": 5, "pills": [10, 20, 40]}	12	2026-01-21 11:26:18.859075	\N	\N
Cucumbers	Crisp and refreshing cucumbers. Perfect for salads and snacking.	{"en": "Cucumbers", "fr": "Concombres", "ar": "\\u062e\\u064a\\u0627\\u0631"}	{"en": "Crisp and refreshing cucumbers. Perfect for salads and snacking.", "fr": "Concombres croquants et rafra\\u00eechissants. Parfaits pour les salades et les collations.", "ar": "\\u062e\\u064a\\u0627\\u0631 \\u0645\\u0642\\u0631\\u0645\\u0634 \\u0648\\u0645\\u0646\\u0639\\u0634. \\u0645\\u062b\\u0627\\u0644\\u064a \\u0644\\u0644\\u0633\\u0644\\u0637\\u0627\\u062a \\u0648\\u0627\\u0644\\u0648\\u062c\\u0628\\u0627\\u062a \\u0627\\u0644\\u062e\\u0641\\u064a\\u0641\\u0629."}	90	KG	500	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/concombre.png	f	t	2	{"type": "range", "min": 5, "max": 100, "step": 5, "pills": [10, 25, 50]}	20	2026-01-21 11:26:24.364669	\N	\N
Zucchini	Fresh zucchini, versatile and healthy. Great for grilling and sautéing.	{"en": "Zucchini", "fr": "Courgettes", "ar": "\\u0643\\u0648\\u0633\\u0629"}	{"en": "Fresh zucchini, versatile and healthy. Great for grilling and saut\\u00e9ing.", "fr": "Courgettes fra\\u00eeches, polyvalentes et saines. Parfaites pour griller et sauter.", "ar": "\\u0643\\u0648\\u0633\\u0629 \\u0637\\u0627\\u0632\\u062c\\u0629 \\u0645\\u062a\\u0639\\u062f\\u062f\\u0629 \\u0627\\u0644\\u0627\\u0633\\u062a\\u062e\\u062f\\u0627\\u0645\\u0627\\u062a \\u0648\\u0635\\u062d\\u064a\\u0629. \\u0631\\u0627\\u0626\\u0639\\u0629 \\u0644\\u0644\\u0634\\u0648\\u0627\\u0621 \\u0648\\u0627\\u0644\\u0642\\u0644\\u064a."}	140	KG	500	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/courgette.png	f	t	2	{"type": "range", "min": 5, "max": 200, "step": 5, "pills": [10, 25, 50]}	22	2026-01-21 11:26:25.664655	\N	\N
Fennel	Fresh fennel bulbs with a mild anise flavor. Great raw or cooked.	{"en": "Fennel", "fr": "Fenouil", "ar": "\\u0634\\u0645\\u0631"}	{"en": "Fresh fennel bulbs with a mild anise flavor. Great raw or cooked.", "fr": "Bulbes de fenouil frais avec une douce saveur d'anis. Parfaits crus ou cuits.", "ar": "\\u0634\\u0645\\u0631 \\u0637\\u0627\\u0632\\u062c \\u0628\\u0646\\u0643\\u0647\\u0629 \\u064a\\u0627\\u0646\\u0633\\u0648\\u0646 \\u062e\\u0641\\u064a\\u0641\\u0629. \\u0631\\u0627\\u0626\\u0639 \\u0646\\u064a\\u0626\\u0627\\u064b \\u0623\\u0648 \\u0645\\u0637\\u0628\\u0648\\u062e\\u0627\\u064b."}	120	KG	60	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/fenouille.png	f	t	2	{"type": "range", "min": 5, "max": 300, "step": 5, "pills": [10, 20, 40]}	23	2026-01-21 11:26:26.650115	\N	\N
Fava Beans	Fresh fava beans, nutritious and hearty. Great for stews and traditional dishes.	{"en": "Fava Beans", "fr": "F\\u00e8ves", "ar": "\\u0641\\u0648\\u0644"}	{"en": "Fresh fava beans, nutritious and hearty. Great for stews and traditional dishes.", "fr": "F\\u00e8ves fra\\u00eeches, nutritives et consistantes. Parfaites pour les plats traditionnels.", "ar": "\\u0641\\u0648\\u0644 \\u0637\\u0627\\u0632\\u062c \\u0645\\u063a\\u0630\\u064a \\u0648\\u0645\\u0634\\u0628\\u0639. \\u0631\\u0627\\u0626\\u0639 \\u0644\\u0644\\u0623\\u0637\\u0628\\u0627\\u0642 \\u0627\\u0644\\u062a\\u0642\\u0644\\u064a\\u062f\\u064a\\u0629 \\u0648\\u0627\\u0644\\u064a\\u062e\\u0646\\u0627\\u062a."}	110	KG	70	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/feve.png	f	t	2	{"type": "range", "min": 5, "max": 200, "step": 5, "pills": [10, 25, 50]}	24	2026-01-21 11:26:27.254705	\N	\N
Green Beans	Fresh green beans, crisp and tender. Great for steaming or stir-frying.	{"en": "Green Beans", "fr": "Haricots verts", "ar": "\\u0641\\u0627\\u0635\\u0648\\u0644\\u064a\\u0627 \\u062e\\u0636\\u0631\\u0627\\u0621"}	{"en": "Fresh green beans, crisp and tender. Great for steaming or stir-frying.", "fr": "Haricots verts frais, croquants et tendres. Parfaits \\u00e0 la vapeur ou saut\\u00e9s.", "ar": "\\u0641\\u0627\\u0635\\u0648\\u0644\\u064a\\u0627 \\u062e\\u0636\\u0631\\u0627\\u0621 \\u0637\\u0627\\u0632\\u062c\\u0629 \\u0645\\u0642\\u0631\\u0645\\u0634\\u0629 \\u0648\\u0637\\u0631\\u064a\\u0629. \\u0631\\u0627\\u0626\\u0639\\u0629 \\u0628\\u0627\\u0644\\u0628\\u062e\\u0627\\u0631 \\u0623\\u0648 \\u0627\\u0644\\u062a\\u0634\\u0648\\u064a\\u062d."}	240	KG	70	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/haricot-vert.png	f	t	2	{"type": "range", "min": 5, "max": 300, "step": 5, "pills": [10, 25, 50]}	25	2026-01-21 11:26:27.905175	\N	\N
Turnips	Fresh turnips with a mild, slightly sweet flavor. Great for soups and stews.	{"en": "Turnips", "fr": "Navets", "ar": "\\u0644\\u0641\\u062a"}	{"en": "Fresh turnips with a mild, slightly sweet flavor. Great for soups and stews.", "fr": "Navets frais au go\\u00fbt doux et l\\u00e9g\\u00e8rement sucr\\u00e9. Parfaits pour soupes et rago\\u00fbts.", "ar": "\\u0644\\u0641\\u062a \\u0637\\u0627\\u0632\\u062c \\u0628\\u0646\\u0643\\u0647\\u0629 \\u062e\\u0641\\u064a\\u0641\\u0629 \\u0648\\u062d\\u0644\\u0648\\u0629 \\u0642\\u0644\\u064a\\u0644\\u0627\\u064b. \\u0631\\u0627\\u0626\\u0639 \\u0644\\u0644\\u0634\\u0648\\u0631\\u0628\\u0627\\u062a \\u0648\\u0627\\u0644\\u064a\\u062e\\u0646\\u0627\\u062a."}	70	KG	500	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/navet.png	f	t	2	{"type": "range", "min": 5, "max": 200, "step": 5, "pills": [10, 25, 50]}	26	2026-01-21 11:26:28.637802	\N	\N
Onions	Fresh onions, a kitchen essential. Perfect for any savory dish.	{"en": "Onions", "fr": "Oignons", "ar": "\\u0628\\u0635\\u0644"}	{"en": "Fresh onions, a kitchen essential. Perfect for any savory dish.", "fr": "Oignons frais, un incontournable de la cuisine. Parfaits pour tout plat sal\\u00e9.", "ar": "\\u0628\\u0635\\u0644 \\u0637\\u0627\\u0632\\u062c\\u060c \\u0623\\u0633\\u0627\\u0633\\u064a \\u0641\\u064a \\u0627\\u0644\\u0645\\u0637\\u0628\\u062e. \\u0645\\u062b\\u0627\\u0644\\u064a \\u0644\\u0623\\u064a \\u0637\\u0628\\u0642 \\u0645\\u0627\\u0644\\u062d."}	80	KG	500	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/oignion.png	f	t	2	{"type": "range", "min": 10, "max": 200, "step": 10, "pills": [30, 60, 100]}	27	2026-01-21 11:26:29.480808	\N	\N
Cauliflower	Fresh cauliflower, mild and versatile. Great roasted, steamed, or in gratins.	{"en": "Cauliflower", "fr": "Chou-fleur", "ar": "\\u0642\\u0631\\u0646\\u0628\\u064a\\u0637"}	{"en": "Fresh cauliflower, mild and versatile. Great roasted, steamed, or in gratins.", "fr": "Chou-fleur frais, doux et polyvalent. D\\u00e9licieux r\\u00f4ti, vapeur ou en gratin.", "ar": "\\u0642\\u0631\\u0646\\u0628\\u064a\\u0637 \\u0637\\u0627\\u0632\\u062c \\u0628\\u0637\\u0639\\u0645 \\u062e\\u0641\\u064a\\u0641 \\u0648\\u0645\\u062a\\u0639\\u062f\\u062f \\u0627\\u0644\\u0627\\u0633\\u062a\\u062e\\u062f\\u0627\\u0645\\u0627\\u062a. \\u0631\\u0627\\u0626\\u0639 \\u0645\\u0634\\u0648\\u064a\\u0627\\u064b \\u0623\\u0648 \\u0645\\u0637\\u0647\\u0648\\u0627\\u064b \\u0639\\u0644\\u0649 \\u0627\\u0644\\u0628\\u062e\\u0627\\u0631."}	60	KG	490	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/chou-fleur.png	f	t	2	{"type": "range", "min": 5, "max": 200, "step": 5, "pills": [10, 25, 50]}	19	2026-01-21 11:26:23.679821	\N	\N
Potatoes	Versatile potatoes perfect for any cooking method. A kitchen staple.	{"en": "Potatoes", "fr": "Pommes de terre", "ar": "\\u0628\\u0637\\u0627\\u0637\\u0627"}	{"en": "Versatile potatoes perfect for any cooking method. A kitchen staple.", "fr": "Pommes de terre polyvalentes parfaites pour toute m\\u00e9thode de cuisson. Un incontournable de la cuisine.", "ar": "\\u0628\\u0637\\u0627\\u0637\\u0627 \\u0645\\u062a\\u0639\\u062f\\u062f\\u0629 \\u0627\\u0644\\u0627\\u0633\\u062a\\u062e\\u062f\\u0627\\u0645\\u0627\\u062a \\u0645\\u062b\\u0627\\u0644\\u064a\\u0629 \\u0644\\u0623\\u064a \\u0637\\u0631\\u064a\\u0642\\u0629 \\u0637\\u0628\\u062e. \\u0623\\u0633\\u0627\\u0633\\u064a\\u0629 \\u0641\\u064a \\u0627\\u0644\\u0645\\u0637\\u0628\\u062e."}	55	KG	200	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/potato.png	f	t	2	{"type": "range", "min": 10, "max": 300, "step": 10, "pills": [50, 100, 150]}	28	2026-01-21 11:26:30.309832	\N	\N
Radishes	Fresh radishes, crunchy and peppery. Great in salads and sandwiches.	{"en": "Radishes", "fr": "Radis", "ar": "\\u0641\\u062c\\u0644"}	{"en": "Fresh radishes, crunchy and peppery. Great in salads and sandwiches.", "fr": "Radis frais, croquants et l\\u00e9g\\u00e8rement piquants. Parfaits en salade ou sandwich.", "ar": "\\u0641\\u062c\\u0644 \\u0637\\u0627\\u0632\\u062c \\u0645\\u0642\\u0631\\u0645\\u0634 \\u0648\\u062d\\u0627\\u0631 \\u0642\\u0644\\u064a\\u0644\\u0627\\u064b. \\u0631\\u0627\\u0626\\u0639 \\u0641\\u064a \\u0627\\u0644\\u0633\\u0644\\u0637\\u0627\\u062a \\u0648\\u0627\\u0644\\u0633\\u0646\\u062f\\u0648\\u064a\\u0634\\u0627\\u062a."}	85	KG	400	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/radis.png	f	t	2	{"type": "range", "min": 5, "max": 300, "step": 5, "pills": [10, 20, 40]}	29	2026-01-21 11:26:31.243313	\N	\N
Lettuce	Fresh lettuce, crisp and light. Perfect for salads and wraps.	{"en": "Lettuce", "fr": "Salade", "ar": "\\u062e\\u0633"}	{"en": "Fresh lettuce, crisp and light. Perfect for salads and wraps.", "fr": "Salade fra\\u00eeche, croquante et l\\u00e9g\\u00e8re. Parfaite pour salades et wraps.", "ar": "\\u062e\\u0633 \\u0637\\u0627\\u0632\\u062c \\u0648\\u0645\\u0642\\u0631\\u0645\\u0634 \\u0648\\u062e\\u0641\\u064a\\u0641. \\u0645\\u062b\\u0627\\u0644\\u064a \\u0644\\u0644\\u0633\\u0644\\u0637\\u0627\\u062a \\u0648\\u0627\\u0644\\u0644\\u0641\\u0627\\u0626\\u0641."}	120	KG	300	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/salade.png	f	t	2	{"type": "range", "min": 5, "max": 300, "step": 5, "pills": [10, 20, 40]}	30	2026-01-21 11:26:31.948552	\N	\N
Tomatoes	Fresh, ripe tomatoes. Perfect for salads, sauces, and cooking.	{"en": "Tomatoes", "fr": "Tomates", "ar": "\\u0637\\u0645\\u0627\\u0637\\u0645"}	{"en": "Fresh, ripe tomatoes. Perfect for salads, sauces, and cooking.", "fr": "Tomates fra\\u00eeches et m\\u00fbres. Parfaites pour salades, sauces et cuisine.", "ar": "\\u0637\\u0645\\u0627\\u0637\\u0645 \\u0637\\u0627\\u0632\\u062c\\u0629 \\u0648\\u0646\\u0627\\u0636\\u062c\\u0629. \\u0645\\u062b\\u0627\\u0644\\u064a\\u0629 \\u0644\\u0644\\u0633\\u0644\\u0637\\u0627\\u062a \\u0648\\u0627\\u0644\\u0635\\u0644\\u0635\\u0627\\u062a \\u0648\\u0627\\u0644\\u0637\\u0628\\u062e."}	65	KG	500	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/tomate.png	f	t	2	{"type": "range", "min": 5, "max": 500, "step": 5, "pills": [10, 30, 50]}	31	2026-01-21 11:26:32.945337	\N	\N
Bell Peppers	Sweet and crunchy bell peppers. Great for salads, roasting, and cooking.	{"en": "Bell Peppers", "fr": "Poivrons", "ar": "\\u0641\\u0644\\u0641\\u0644 \\u062d\\u0644\\u0648"}	{"en": "Sweet and crunchy bell peppers. Great for salads, roasting, and cooking.", "fr": "Poivrons sucr\\u00e9s et croquants. Parfaits pour salades, r\\u00f4tis et cuisine.", "ar": "\\u0641\\u0644\\u0641\\u0644 \\u062d\\u0644\\u0648 \\u0645\\u0642\\u0631\\u0645\\u0634. \\u0631\\u0627\\u0626\\u0639 \\u0644\\u0644\\u0633\\u0644\\u0637\\u0627\\u062a \\u0648\\u0627\\u0644\\u062a\\u062d\\u0645\\u064a\\u0631 \\u0648\\u0627\\u0644\\u0637\\u0628\\u062e."}	120	KG	400	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/poivron.png	f	t	2	{"type": "range", "min": 5, "max": 500, "step": 5, "pills": [10, 20, 40]}	32	2026-01-21 11:26:34.13893	\N	\N
Hot Peppers	Spicy hot peppers to add heat to your dishes. Use a little for big flavor!	{"en": "Hot Peppers", "fr": "Piments", "ar": "\\u0641\\u0644\\u0641\\u0644 \\u062d\\u0627\\u0631"}	{"en": "Spicy hot peppers to add heat to your dishes. Use a little for big flavor!", "fr": "Piments \\u00e9pic\\u00e9s pour relever vos plats. Une petite quantit\\u00e9 suffit!", "ar": "\\u0641\\u0644\\u0641\\u0644 \\u062d\\u0627\\u0631 \\u0644\\u0625\\u0636\\u0627\\u0641\\u0629 \\u0646\\u0643\\u0647\\u0629 \\u0642\\u0648\\u064a\\u0629. \\u0643\\u0645\\u064a\\u0629 \\u0635\\u063a\\u064a\\u0631\\u0629 \\u062a\\u0643\\u0641\\u064a!"}	120	KG	600	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/piment.png	f	t	2	{"type": "range", "min": 5, "max": 20, "step": 5, "pills": [5, 10, 20, 50, 100]}	33	2026-01-21 11:26:34.996092	\N	\N
Beets	Fresh beets, perfect for salads and roasting. Rich in nutrients.	{"en": "Beets", "fr": "Betteraves", "ar": "\\u0634\\u0645\\u0646\\u062f\\u0631"}	{"en": "Fresh beets, perfect for salads and roasting. Rich in nutrients.", "fr": "Betteraves fra\\u00eeches, parfaites pour les salades et au four. Riches en nutriments.", "ar": "\\u0634\\u0645\\u0646\\u062f\\u0631 \\u0637\\u0627\\u0632\\u062c\\u060c \\u0645\\u062b\\u0627\\u0644\\u064a \\u0644\\u0644\\u0633\\u0644\\u0637\\u0627\\u062a \\u0648\\u0627\\u0644\\u0634\\u0648\\u0627\\u0621. \\u063a\\u0646\\u064a \\u0628\\u0627\\u0644\\u0639\\u0646\\u0627\\u0635\\u0631 \\u0627\\u0644\\u063a\\u0630\\u0627\\u0626\\u064a\\u0629."}	70	KG	75	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/betrave.png	f	t	2	{"type": "range", "min": 5, "max": 500, "step": 5, "pills": [10, 25, 50]}	14	2026-01-21 11:26:20.046098	\N	\N
Carrots	Fresh carrots rich in beta-carotene. Great for salads, stews, and juices.	{"en": "Carrots", "fr": "Carottes", "ar": "\\u062c\\u0632\\u0631"}	{"en": "Fresh carrots rich in beta-carotene. Great for salads, stews, and juices.", "fr": "Carottes fra\\u00eeches riches en b\\u00eata-carot\\u00e8ne. Parfaites pour salades, plats mijot\\u00e9s et jus.", "ar": "\\u062c\\u0632\\u0631 \\u0637\\u0627\\u0632\\u062c \\u063a\\u0646\\u064a \\u0628\\u0627\\u0644\\u0628\\u064a\\u062a\\u0627 \\u0643\\u0627\\u0631\\u0648\\u062a\\u064a\\u0646. \\u0631\\u0627\\u0626\\u0639 \\u0644\\u0644\\u0633\\u0644\\u0637\\u0627\\u062a \\u0648\\u0627\\u0644\\u064a\\u062e\\u0646\\u0627\\u062a \\u0648\\u0627\\u0644\\u0639\\u0635\\u0627\\u0626\\u0631."}	80	KG	225	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/carrote.png	f	t	2	{"type": "range", "min": 5, "max": 300, "step": 5, "pills": [5, 10, 20, 40, 80, 100]}	17	2026-01-21 11:26:22.540301	\N	\N
Coriander	Fresh coriander with a bright, citrusy aroma. Perfect for garnishing and cooking.	{"en": "Coriander", "fr": "Coriandre", "ar": "\\u0643\\u0632\\u0628\\u0631\\u0629"}	{"en": "Fresh coriander with a bright, citrusy aroma. Perfect for garnishing and cooking.", "fr": "Coriandre fra\\u00eeche au parfum citronn\\u00e9. Parfaite pour garnir et cuisiner.", "ar": "\\u0643\\u0632\\u0628\\u0631\\u0629 \\u0637\\u0627\\u0632\\u062c\\u0629 \\u0628\\u0631\\u0627\\u0626\\u062d\\u0629 \\u0645\\u0646\\u0639\\u0634\\u0629. \\u0645\\u062b\\u0627\\u0644\\u064a\\u0629 \\u0644\\u0644\\u062a\\u0632\\u064a\\u064a\\u0646 \\u0648\\u0627\\u0644\\u0637\\u0628\\u062e."}	100	BUNCH	995	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/coriandre.png	f	t	2	{"type": "list", "quantities": [5, 10, 15, 20, 50, 100]}	21	2026-01-21 11:26:25.108483	\N	\N
Bananas	Sweet and nutritious bananas. Perfect for smoothies or a quick snack.	{"en": "Bananas", "fr": "Bananes", "ar": "\\u0645\\u0648\\u0632"}	{"en": "Sweet and nutritious bananas. Perfect for smoothies or a quick snack.", "fr": "Bananes sucr\\u00e9es et nutritives. Parfaites pour les smoothies ou une collation rapide.", "ar": "\\u0645\\u0648\\u0632 \\u062d\\u0644\\u0648 \\u0648\\u0645\\u063a\\u0630\\u064a. \\u0645\\u062b\\u0627\\u0644\\u064a \\u0644\\u0644\\u0639\\u0635\\u0627\\u0626\\u0631 \\u0623\\u0648 \\u0648\\u062c\\u0628\\u0629 \\u062e\\u0641\\u064a\\u0641\\u0629 \\u0633\\u0631\\u064a\\u0639\\u0629."}	550	KG	940	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/banane.png	f	t	1	{"type": "list", "quantities": [6, 12, 18, 24, 30, 50, 100], "pills": [12, 24, 50]}	2	2026-01-21 11:26:09.498307	2026-02-08 22:09:30.892217	\N
Broccoli	Fresh broccoli, packed with nutrients and antioxidants.	{"en": "Broccoli", "fr": "Brocoli", "ar": "\\u0628\\u0631\\u0648\\u0643\\u0644\\u064a"}	{"en": "Fresh broccoli, packed with nutrients and antioxidants.", "fr": "Brocoli frais, riche en nutriments et antioxydants.", "ar": "\\u0628\\u0631\\u0648\\u0643\\u0644\\u064a \\u0637\\u0627\\u0632\\u062c \\u063a\\u0646\\u064a \\u0628\\u0627\\u0644\\u0639\\u0646\\u0627\\u0635\\u0631 \\u0627\\u0644\\u063a\\u0630\\u0627\\u0626\\u064a\\u0629 \\u0648\\u0645\\u0636\\u0627\\u062f\\u0627\\u062a \\u0627\\u0644\\u0623\\u0643\\u0633\\u062f\\u0629."}	90	KG	470	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/brocoli.png	f	t	2	{"type": "range", "min": 5, "max": 250, "step": 5, "pills": [15, 30, 60]}	15	2026-01-21 11:26:21.198675	\N	\N
White Grapes	Fresh white grapes, sweet and juicy. Ideal for snacking, fruit salads, or desserts.	{"en": "White Grapes", "fr": "Raisin blanc", "ar": "\\u0639\\u0646\\u0628 \\u0623\\u0628\\u064a\\u0636"}	{"en": "Fresh white grapes, sweet and juicy. Ideal for snacking, fruit salads, or desserts.", "fr": "Raisin blanc frais, sucr\\u00e9 et juteux. Id\\u00e9al en collation, salade de fruits ou dessert.", "ar": "\\u0639\\u0646\\u0628 \\u0623\\u0628\\u064a\\u0636 \\u0637\\u0627\\u0632\\u062c \\u062d\\u0644\\u0648 \\u0648\\u0639\\u0635\\u064a\\u0631\\u064a. \\u0645\\u062b\\u0627\\u0644\\u064a \\u0643\\u0648\\u062c\\u0628\\u0629 \\u062e\\u0641\\u064a\\u0641\\u0629 \\u0623\\u0648 \\u0641\\u064a \\u0633\\u0644\\u0637\\u0627\\u062a \\u0627\\u0644\\u0641\\u0648\\u0627\\u0643\\u0647 \\u0623\\u0648 \\u0627\\u0644\\u062d\\u0644\\u0648\\u064a\\u0627\\u062a"}	150	KG	1000	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/raisin-blanc.png	f	t	1	{"type": "range", "min": 10, "max": 100, "step": 5, "pills": [10, 20, 40]}	35	2026-01-22 23:09:15.812477	2026-01-22 23:13:53.356496	\N
Apricots	Sweet, tender apricots. Great for snacking, desserts, or jams.	{"en": "Apricots", "fr": "Abricots", "ar": "\\u0645\\u0634\\u0645\\u0634"}	{"en": "Sweet, tender apricots. Great for snacking, desserts, or jams.", "fr": "Abricots sucr\\u00e9s et tendres. Parfaits pour grignoter, les desserts ou les confitures.", "ar": "\\u0645\\u0634\\u0645\\u0634 \\u062d\\u0644\\u0648 \\u0648\\u0637\\u0631\\u064a. \\u0645\\u062b\\u0627\\u0644\\u064a \\u0644\\u0644\\u0648\\u062c\\u0628\\u0627\\u062a \\u0627\\u0644\\u062e\\u0641\\u064a\\u0641\\u0629 \\u0623\\u0648 \\u0627\\u0644\\u062d\\u0644\\u0648\\u064a\\u0627\\u062a \\u0623\\u0648 \\u0627\\u0644\\u0645\\u0631\\u0628\\u0649."}	200	KG	970	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/aprico.png	f	t	1	{"type": "range", "min": 5, "max": 500, "step": 5, "pills": [10, 25, 50]}	1	2026-01-21 11:26:08.912252	2026-01-31 14:44:44.240421	\N
Garlic	Fresh garlic bulbs with a strong aroma and rich flavor. Essential for cooking and seasoning	{"en": "Garlic", "fr": "Ail", "ar": "\\u062b\\u0648\\u0645"}	{"en": "Fresh garlic bulbs with a strong aroma and rich flavor. Essential for cooking and seasoning", "fr": "Bulbes d\\u2019ail frais au parfum intense et \\u00e0 la saveur riche. Indispensables en cuisine", "ar": "\\u062b\\u0648\\u0645 \\u0637\\u0627\\u0632\\u062c \\u0628\\u0631\\u0627\\u0626\\u062d\\u0629 \\u0642\\u0648\\u064a\\u0629 \\u0648\\u0646\\u0643\\u0647\\u0629 \\u063a\\u0646\\u064a\\u0629. \\u0623\\u0633\\u0627\\u0633\\u064a \\u0641\\u064a \\u0627\\u0644\\u0637\\u0628\\u062e \\u0648\\u0627\\u0644\\u062a\\u062a\\u0628\\u064a\\u0644"}	240	KG	4990	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/ail.png	f	t	2	{"type": "range", "min": 5, "max": 100, "step": 5, "pills": [10, 20, 50]}	34	2026-01-22 19:33:05.85422	\N	\N
Watermelon	Juicy and refreshing watermelon, perfect for summer snacks and desserts.	{"en": "Watermelon", "fr": "Past\\u00e8que", "ar": "\\u0628\\u0637\\u064a\\u062e"}	{"en": "Juicy and refreshing watermelon, perfect for summer snacks and desserts.", "fr": "Past\\u00e8que juteuse et rafra\\u00eechissante, parfaite pour les collations et desserts d'\\u00e9t\\u00e9.", "ar": "\\u0628\\u0637\\u064a\\u062e \\u0639\\u0635\\u064a\\u0631\\u064a \\u0648\\u0645\\u0646\\u0639\\u0634\\u060c \\u0645\\u062b\\u0627\\u0644\\u064a \\u0644\\u0644\\u0648\\u062c\\u0628\\u0627\\u062a \\u0627\\u0644\\u062e\\u0641\\u064a\\u0641\\u0629 \\u0648\\u0627\\u0644\\u062d\\u0644\\u0648\\u064a\\u0627\\u062a \\u0627\\u0644\\u0635\\u064a\\u0641\\u064a\\u0629"}	60	KG	5000	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/pasteque.png	f	t	1	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	37	2026-01-31 12:13:12.981737	2026-01-31 12:33:03.210218	\N
Chickpeas	Dried chickpeas with a mild nutty flavor. Ideal for soups, stews, salads, and hummus.	{"en": "Chickpeas", "fr": "Pois chiches", "ar": "\\u062d\\u0645\\u0635"}	{"en": "Dried chickpeas with a mild nutty flavor. Ideal for soups, stews, salads, and hummus.", "fr": "Pois chiches secs au go\\u00fbt doux et l\\u00e9g\\u00e8rement noisette. Id\\u00e9als pour les soupes, rago\\u00fbts, salades et houmous.", "ar": "\\u062d\\u0645\\u0635 \\u0645\\u062c\\u0641\\u0641 \\u0628\\u0646\\u0643\\u0647\\u0629 \\u062e\\u0641\\u064a\\u0641\\u0629 \\u0648\\u0645\\u0627\\u0626\\u0644\\u0629 \\u0644\\u0644\\u062c\\u0648\\u0632. \\u0645\\u062b\\u0627\\u0644\\u064a \\u0644\\u0644\\u0634\\u0648\\u0631\\u0628\\u0627\\u062a \\u0648\\u0627\\u0644\\u064a\\u062e\\u0646\\u0627\\u062a \\u0648\\u0627\\u0644\\u0633\\u0644\\u0637\\u0627\\u062a \\u0648\\u0627\\u0644\\u062d\\u0645\\u0635."}	190	KG	1000	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/pois-chiche.png	f	t	4	{"type": "range", "min": 1, "max": 100, "step": 5, "pills": [5, 10, 15]}	38	2026-01-31 14:52:57.04838	\N	\N
Pineapple	Ripe pineapple, sweet and juicy with a fragrant tropical flavor. Perfect for fresh snacks, smoothies, and desserts.	{"en": "Pineapple", "fr": "Ananas", "ar": "\\u0623\\u0646\\u0627\\u0646\\u0627\\u0633"}	{"en": "Ripe pineapple, sweet and juicy with a fragrant tropical flavor. Perfect for fresh snacks, smoothies, and desserts.", "fr": "Ananas m\\u00fbr, sucr\\u00e9 et juteux au parfum tropical. Parfait en collation, smoothie ou dessert.", "ar": "\\u0623\\u0646\\u0627\\u0646\\u0627\\u0633 \\u0646\\u0627\\u0636\\u062c \\u062d\\u0644\\u0648 \\u0648\\u0639\\u0635\\u064a\\u0631\\u064a \\u0628\\u0646\\u0643\\u0647\\u0629 \\u0627\\u0633\\u062a\\u0648\\u0627\\u0626\\u064a\\u0629 \\u0639\\u0637\\u0631\\u0629. \\u0645\\u062b\\u0627\\u0644\\u064a \\u0644\\u0644\\u0648\\u062c\\u0628\\u0627\\u062a \\u0627\\u0644\\u062e\\u0641\\u064a\\u0641\\u0629 \\u0648\\u0627\\u0644\\u0639\\u0635\\u0627\\u0626\\u0631 \\u0648\\u0627\\u0644\\u062d\\u0644\\u0648\\u064a\\u0627\\u062a"}	400	KG	490	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/ananas.png 	f	t	1	{"type": "range", "min": 5, "max": 100, "step": 5, "pills": [10, 20, 40]}	36	2026-01-22 23:42:51.116275	\N	\N
Izdihar Tomato 400g	24 units per box	{"en": "Izdihar Tomato 400g", "fr": "Tomate Izdihar 400g", "ar": "\\u0637\\u0645\\u0627\\u0637\\u0645 \\u0625\\u0632\\u062f\\u0647\\u0627\\u0631 400\\u063a"}	{"en": "24 units per box", "fr": "24 unit\\u00e9s par carton", "ar": "24 \\u0648\\u062d\\u062f\\u0629 \\u0641\\u064a \\u0627\\u0644\\u0635\\u0646\\u062f\\u0648\\u0642"}	170	PIECE	1000	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/Tomate-Izdihar-400g.png	f	t	5	{"type": "range", "min": 24, "max": 120, "step": 24, "pills": [24, 48, 72]}	39	2026-02-09 22:06:16.266861	2026-02-11 11:56:52.556082	\N
Apricot Jam	Delicious apricot jam made with ripe apricots, offering a smooth texture and naturally sweet flavor, perfect for toast and desserts.	{"en": "Apricot Jam", "fr": "Confiture d'Abricots", "ar": "\\u0645\\u0631\\u0628\\u0649 \\u0627\\u0644\\u0645\\u0634\\u0645\\u0634"}	{"en": "Delicious apricot jam made with ripe apricots, offering a smooth texture and naturally sweet flavor, perfect for toast and desserts.", "fr": "Confiture d'abricots savoureuse et riche en fruits, pr\\u00e9par\\u00e9e avec des abricots m\\u00fbrs pour une texture onctueuse et un go\\u00fbt naturellement sucr\\u00e9, id\\u00e9ale pour les tartines et les desserts.", "ar": " \\u0645\\u0631\\u0628\\u0649 \\u0645\\u0634\\u0645\\u0634 \\u0644\\u0630\\u064a\\u0630 \\u0645\\u0635\\u0646\\u0648\\u0639 \\u0645\\u0646 \\u0645\\u0634\\u0645\\u0634 \\u0646\\u0627\\u0636\\u062c \\u0628\\u0642\\u0648\\u0627\\u0645 \\u0646\\u0627\\u0639\\u0645 \\u0648\\u0646\\u0643\\u0647\\u0629 \\u062d\\u0644\\u0648\\u0629 \\u0637\\u0628\\u064a\\u0639\\u064a\\u0629\\u060c \\u0645\\u062b\\u0627\\u0644\\u064a \\u0644\\u0644\\u062e\\u0628\\u0632 \\u0627\\u0644\\u0645\\u062d\\u0645\\u0635 \\u0648\\u0627\\u0644\\u062d\\u0644\\u0648\\u064a\\u0627\\u062a."}	150	PIECE	500	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/confiture-abricots-450g.png	f	t	5	{"type": "range", "min": 5, "max": 100, "step": 1, "pills": [24, 48, 72]}	41	2026-02-13 09:36:18.011852	\N	\N
Harissa	Spicy and flavorful harissa made from carefully selected red chili peppers, perfect for enhancing traditional dishes, sauces, and marinades.	{"en": "Harissa", "fr": "Harissa", "ar": "\\u0647\\u0631\\u064a\\u0633\\u0629"}	{"en": "Spicy and flavorful harissa made from carefully selected red chili peppers, perfect for enhancing traditional dishes, sauces, and marinades.", "fr": "Harissa piquante et savoureuse pr\\u00e9par\\u00e9e \\u00e0 base de piments rouges soigneusement s\\u00e9lectionn\\u00e9s, id\\u00e9ale pour relever vos plats traditionnels, sauces et marinades.", "ar": " \\u0647\\u0631\\u064a\\u0633\\u0629 \\u062d\\u0627\\u0631\\u0629 \\u0648\\u0644\\u0630\\u064a\\u0630\\u0629 \\u0645\\u0635\\u0646\\u0648\\u0639\\u0629 \\u0645\\u0646 \\u0641\\u0644\\u0641\\u0644 \\u0623\\u062d\\u0645\\u0631 \\u0645\\u062e\\u062a\\u0627\\u0631 \\u0628\\u0639\\u0646\\u0627\\u064a\\u0629\\u060c \\u0645\\u062b\\u0627\\u0644\\u064a\\u0629 \\u0644\\u0625\\u0636\\u0627\\u0641\\u0629 \\u0646\\u0643\\u0647\\u0629 \\u0645\\u0645\\u064a\\u0632\\u0629 \\u0644\\u0644\\u0623\\u0637\\u0628\\u0627\\u0642 \\u0627\\u0644\\u062a\\u0642\\u0644\\u064a\\u062f\\u064a\\u0629 \\u0648\\u0627\\u0644\\u0635\\u0644\\u0635\\u0627\\u062a \\u0648\\u0627\\u0644\\u062a\\u062a\\u0628\\u064a\\u0644\\u0627\\u062a"}	160	PIECE	500	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/harissa-760g.png	f	t	5	{"type": "range", "min": 5, "max": 100, "step": 1, "pills": [24, 48, 72]}	42	2026-02-13 09:44:28.327035	\N	\N
Izdihar Tomato Sauce 2400g	24 units per box	{"en": "Izdihar Tomato Sauce 2400g", "fr": "Sauce Tomate Izdihar 2400g", "ar": "\\u0635\\u0644\\u0635\\u0629 \\u0637\\u0645\\u0627\\u0637\\u0645 \\u0625\\u0632\\u062f\\u0647\\u0627\\u0631 2400\\u063a"}	{"en": "24 units per box", "fr": "24 unit\\u00e9s par carton", "ar": "24 \\u0648\\u062d\\u062f\\u0629 \\u0641\\u064a \\u0627\\u0644\\u0635\\u0646\\u062f\\u0648\\u0642"}	550	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/sauce-tomate-2400g.png	f	t	5	{"type": "range", "min": 24, "max": 120, "step": 1, "pills": [24, 48, 72]}	40	2026-02-11 22:48:32.905711	2026-02-13 12:09:21.73888	2
Tomato Sauce	Rich and flavorful tomato sauce made from sun-ripened tomatoes, perfect for pasta, pizza, and slow-cooked dishes.	{"en": "Tomato Sauce", "fr": "Sauce Tomate", "ar": "\\u0635\\u0644\\u0635\\u0629 \\u0637\\u0645\\u0627\\u0637\\u0645"}	{"en": "Rich and flavorful tomato sauce made from sun-ripened tomatoes, perfect for pasta, pizza, and slow-cooked dishes.", "fr": "Sauce tomate riche et savoureuse pr\\u00e9par\\u00e9e \\u00e0 partir de tomates m\\u00fbries au soleil, id\\u00e9ale pour accompagner vos p\\u00e2tes, pizzas et plats mijot\\u00e9s.", "ar": "\\u0635\\u0644\\u0635\\u0629 \\u0637\\u0645\\u0627\\u0637\\u0645 \\u063a\\u0646\\u064a\\u0629 \\u0648\\u0644\\u0630\\u064a\\u0630\\u0629 \\u0645\\u0635\\u0646\\u0648\\u0639\\u0629 \\u0645\\u0646 \\u0637\\u0645\\u0627\\u0637\\u0645 \\u0646\\u0627\\u0636\\u062c\\u0629 \\u062a\\u062d\\u062a \\u0623\\u0634\\u0639\\u0629 \\u0627\\u0644\\u0634\\u0645\\u0633\\u060c \\u0645\\u062b\\u0627\\u0644\\u064a\\u0629 \\u0644\\u0644\\u0645\\u0643\\u0631\\u0648\\u0646\\u0629 \\u0648\\u0627\\u0644\\u0628\\u064a\\u062a\\u0632\\u0627 \\u0648\\u0627\\u0644\\u0623\\u0637\\u0628\\u0627\\u0642"}	145	PIECE	500	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/sauce-tomate-700ml.png	f	t	5	{"type": "range", "min": 5, "max": 100, "step": 1, "pills": [24, 48, 72]}	43	2026-02-13 09:51:13.13138	\N	\N
White Sugar 5kg	Cevital granulated white sugar in a 5kg bag, perfect for baking, hot drinks, and all your culinary preparations.	{"en": "White Sugar 5kg", "fr": "Sucre Blanc 5Kg", "ar": "\\u0633\\u0643\\u0631 \\u0623\\u0628\\u064a\\u0636  5\\u0643\\u063a"}	{"en": "Cevital granulated white sugar in a 5kg bag, perfect for baking, hot drinks, and all your culinary preparations.", "fr": "Sucre blanc cristallis\\u00e9 Cevital en sac de 5kg, id\\u00e9al pour la p\\u00e2tisserie, les boissons chaudes et toutes vos pr\\u00e9parations culinaires.", "ar": "\\u0633\\u0643\\u0631 \\u0623\\u0628\\u064a\\u0636 \\u0645\\u062d\\u0628\\u0628 \\u0645\\u0646 \\u0633\\u064a\\u0641\\u064a\\u062a\\u0627\\u0644 \\u0641\\u064a \\u0643\\u064a\\u0633 5\\u0643\\u063a\\u060c \\u0645\\u062b\\u0627\\u0644\\u064a \\u0644\\u0644\\u062d\\u0644\\u0648\\u064a\\u0627\\u062a \\u0648\\u0627\\u0644\\u0645\\u0634\\u0631\\u0648\\u0628\\u0627\\u062a \\u0627\\u0644\\u0633\\u0627\\u062e\\u0646\\u0629 \\u0648\\u062c\\u0645\\u064a\\u0639 \\u062a\\u062d\\u0636\\u064a\\u0631\\u0627\\u062a\\u0643 \\u0627\\u0644\\u0645\\u0637\\u0628\\u062e\\u064a\\u0629."}	90	KG	500	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/sucre-5kg.png	f	t	10	{"type": "range", "min": 5, "max": 100, "step": 1, "pills": [15, 30, 45]}	44	2026-02-13 09:57:46.263634	2026-02-13 10:48:34.599033	\N
White Sugar 2kg	Cevital granulated white sugar in a 2kg bag, perfect for baking, hot drinks, and all your culinary preparations.	{"en": "White Sugar 2kg", "fr": "Sucre Blanc 2Kg", "ar": "\\u0633\\u0643\\u0631 \\u0623\\u0628\\u064a\\u0636 2\\u0643\\u063a"}	{"en": "Cevital granulated white sugar in a 2kg bag, perfect for baking, hot drinks, and all your culinary preparations.", "fr": "Sucre blanc cristallis\\u00e9 Cevital en sac de 2kg, id\\u00e9al pour la p\\u00e2tisserie, les boissons chaudes et toutes vos pr\\u00e9parations culinaires.", "ar": "\\u0633\\u0643\\u0631 \\u0623\\u0628\\u064a\\u0636 \\u0645\\u062d\\u0628\\u0628 \\u0645\\u0646 \\u0633\\u064a\\u0641\\u064a\\u062a\\u0627\\u0644 \\u0641\\u064a \\u0643\\u064a\\u0633 2\\u0643\\u063a\\u060c \\u0645\\u062b\\u0627\\u0644\\u064a \\u0644\\u0644\\u062d\\u0644\\u0648\\u064a\\u0627\\u062a \\u0648\\u0627\\u0644\\u0645\\u0634\\u0631\\u0648\\u0628\\u0627\\u062a \\u0627\\u0644\\u0633\\u0627\\u062e\\u0646\\u0629 \\u0648\\u062c\\u0645\\u064a\\u0639 \\u062a\\u062d\\u0636\\u064a\\u0631\\u0627\\u062a\\u0643 \\u0627\\u0644\\u0645\\u0637\\u0628\\u062e\\u064a\\u0629."}	90	KG	500	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/sucre-2kg.png	f	t	10	{"type": "range", "min": 5, "max": 100, "step": 15, "pills": [15, 30, 45]}	46	2026-02-13 10:57:44.896526	\N	\N
White Sugar 1Kg	Cevital granulated white sugar in a 1kg bag, perfect for baking, hot drinks, and all your culinary preparations.	{"en": "White Sugar 1Kg", "fr": "Sucre Blanc 1Kg", "ar": "\\u0633\\u0643\\u0631 \\u0623\\u0628\\u064a\\u0636 1\\u0643\\u063a"}	{"en": "Cevital granulated white sugar in a 1kg bag, perfect for baking, hot drinks, and all your culinary preparations.", "fr": "Sucre blanc cristallis\\u00e9 Cevital en sac de 1kg, id\\u00e9al pour la p\\u00e2tisserie, les boissons chaudes et toutes vos pr\\u00e9parations culinaires.", "ar": "\\u0633\\u0643\\u0631 \\u0623\\u0628\\u064a\\u0636 \\u0645\\u062d\\u0628\\u0628 \\u0645\\u0646 \\u0633\\u064a\\u0641\\u064a\\u062a\\u0627\\u0644 \\u0641\\u064a \\u0643\\u064a\\u0633 1\\u0643\\u063a\\u060c \\u0645\\u062b\\u0627\\u0644\\u064a \\u0644\\u0644\\u062d\\u0644\\u0648\\u064a\\u0627\\u062a \\u0648\\u0627\\u0644\\u0645\\u0634\\u0631\\u0648\\u0628\\u0627\\u062a \\u0627\\u0644\\u0633\\u0627\\u062e\\u0646\\u0629 \\u0648\\u062c\\u0645\\u064a\\u0639 \\u062a\\u062d\\u0636\\u064a\\u0631\\u0627\\u062a\\u0643 \\u0627\\u0644\\u0645\\u0637\\u0628\\u062e\\u064a\\u0629."}	90	KG	500	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/sucre-1kg.png	f	t	10	{"type": "range", "min": 1, "max": 100, "step": 1, "pills": [15, 30, 45]}	45	2026-02-13 10:01:34.294467	2026-02-13 12:07:55.227672	1
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.order_items (order_id, product_id, quantity, unit_price, id, product_name, product_unit) FROM stdin;
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.orders (user_id, status, shipping_address, contact_phone, total_amount, id, created_at, updated_at, promotion_id, discount_amount, subtotal) FROM stdin;
3	PENDING	123 azaghar	3475577129	9400	1	2026-01-21 16:47:09.731915	\N	\N	0.00	9400.00
5	CANCELLED	123 rue lycée 	347474678	22050	2	2026-01-21 19:43:56.030349	2026-01-21 19:44:46.451001	\N	0.00	22050.00
6	PENDING	123 tafsa boumad	4576748903	10800	3	2026-01-21 23:06:44.813739	\N	\N	0.00	10800.00
7	DELIVERED	Tafsa boumad agouni gueghrane	0696497278	1000	4	2026-01-22 23:19:36.619875	2026-01-22 23:21:28.476073	\N	0.00	1000.00
7	CANCELLED	Tafsa boumad agouni gueghrane	0696497278	3500	5	2026-01-23 23:31:39.140683	2026-01-24 13:09:28.588811	\N	0.00	3500.00
7	PENDING	Tafsa boumad agouni gueghrane	0696497278	5200	6	2026-01-25 14:14:01.234242	\N	\N	0.00	5200.00
9	DELIVERED	125 azeghar	5536480030	25200	7	2026-02-08 21:57:26.671199	2026-02-08 21:59:14.608985	\N	0.00	25200.00
9	CANCELLED	125 azeghar	5536480030	2700	9	2026-02-08 22:05:16.29164	2026-02-13 21:58:46.249168	\N	0.00	2700.00
9	CANCELLED	125 azeghar	5536480030	3500	8	2026-02-08 21:59:49.655564	2026-02-13 21:59:40.491452	\N	0.00	3500.00
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.products (name, description, name_translations, description_translations, price, unit, stock_quantity, image_url, is_organic, is_active, category_id, quantity_config, id, created_at, updated_at, brand_id) FROM stdin;
Bimo Tango Wafer 75g	Bimo Tango wafer in a 75g pack, crispy and filled with chocolate cream, perfect for a tasty and indulgent break.	{"en": "Bimo Tango Wafer 75g", "fr": "Tango Bimo 75g", "ar": "\\u0628\\u064a\\u0645\\u0648 \\u062a\\u0627\\u0646\\u063a\\u0648 75\\u063a"}	{"en": "Bimo Tango wafer in a 75g pack, crispy and filled with chocolate cream, perfect for a tasty and indulgent break.", "fr": "Gateau Tango Bimo en paquet de 75g, croustillante et fourr\\u00e9e \\u00e0 la cr\\u00e8me chocolat\\u00e9e, id\\u00e9ale pour une pause gourmande et savoureuse.", "ar": "\\u0648\\u064a\\u0641\\u0631 \\u0628\\u064a\\u0645\\u0648 \\u062a\\u0627\\u0646\\u063a\\u0648 \\u0641\\u064a \\u0639\\u0628\\u0648\\u0629 75\\u063a\\u060c \\u0645\\u0642\\u0631\\u0645\\u0634 \\u0648\\u0645\\u062d\\u0634\\u0648 \\u0628\\u0643\\u0631\\u064a\\u0645\\u0629 \\u0627\\u0644\\u0634\\u0648\\u0643\\u0648\\u0644\\u0627\\u062a\\u0629\\u060c \\u0645\\u062b\\u0627\\u0644\\u064a \\u0644\\u0627\\u0633\\u062a\\u0631\\u0627\\u062d\\u0629 \\u0644\\u0630\\u064a\\u0630\\u0629 \\u0648\\u0645\\u0645\\u062a\\u0639\\u0629"}	55	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/tango.bimo.png	f	t	14	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	122	2026-02-16 13:33:10.037614	\N	13
Tomato Sauce 700ml	Smooth and flavorful tomato sauce made from sun-ripened tomatoes, perfect for pasta, pizza, and slow-cooked dishes.	{"en": "Tomato Sauce 700ml", "fr": "Sauce Tomate 700m", "ar": "\\u0635\\u0644\\u0635\\u0629 \\u0637\\u0645\\u0627\\u0637\\u0645 700\\u0645\\u0644"}	{"en": "Smooth and flavorful tomato sauce made from sun-ripened tomatoes, perfect for pasta, pizza, and slow-cooked dishes.", "fr": "\\"Sauce tomate onctueuse et savoureuse pr\\u00e9par\\u00e9e \\u00e0 partir de tomates m\\u00fbries au soleil, id\\u00e9ale pour accompagner vos p\\u00e2tes, pizzas et plats mijot\\u00e9s.", "ar": "\\u0635\\u0644\\u0635\\u0629 \\u0637\\u0645\\u0627\\u0637\\u0645 \\u0628\\u0642\\u0648\\u0627\\u0645 \\u0646\\u0627\\u0639\\u0645 \\u0648\\u0646\\u0643\\u0647\\u0629 \\u063a\\u0646\\u064a\\u0629 \\u0645\\u0635\\u0646\\u0648\\u0639\\u0629 \\u0645\\u0646 \\u0637\\u0645\\u0627\\u0637\\u0645 \\u0646\\u0627\\u0636\\u062c\\u0629 \\u062a\\u062d\\u062a \\u0623\\u0634\\u0639\\u0629 \\u0627\\u0644\\u0634\\u0645\\u0633\\u060c \\u0645\\u062b\\u0627\\u0644\\u064a\\u0629 \\u0644\\u0644\\u0645\\u0643\\u0631\\u0648\\u0646\\u0629 \\u0648\\u0627\\u0644\\u0628\\u064a\\u062a\\u0632\\u0627 \\u0648\\u0627\\u0644\\u0623\\u0637\\u0628\\u0627\\u0642 \\u0627\\u0644\\u0645\\u0637\\u0647\\u064a\\u0629 \\u0628\\u0628\\u0637\\u0621."}	120	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/sauce-tomate-700ml.png	f	t	17	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	49	2026-02-13 14:00:47.627982	\N	2
Apricot Jam 900g	12 units per box	{"en": "Apricot Jam 900g", "fr": "Confiture Abricots 900g", "ar": "\\u0645\\u0631\\u0628\\u0649 \\u0627\\u0644\\u0645\\u0634\\u0645\\u0634 900\\u063a"}	{"en": "12 units per box", "fr": "        12 unit\\u00e9s par carton\\n", "ar": "12 \\u0648\\u062d\\u062f\\u0629 \\u0641\\u064a \\u0627\\u0644\\u0635\\u0646\\u062f\\u0648\\u0642"}	245	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/confiture-abricots-900g.png	f	t	18	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	50	2026-02-13 15:04:36.203512	2026-02-13 15:27:12.439868	2
Sim Macaroni 500g	20 units per box	{"en": "Sim Macaroni 500g", "fr": "Macaroni Sim 500g", "ar": "\\u0645\\u0643\\u0631\\u0648\\u0646\\u0629 \\u0633\\u064a\\u0645 500\\u063a"}	{"en": "20 units per box", "fr": "20 unit\\u00e9s par carton", "ar": "       20 \\u0648\\u062d\\u062f\\u0629 \\u0641\\u064a \\u0627\\u0644\\u0635\\u0646\\u062f\\u0648\\u0642"}	50	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/macaron-sim-500g.png	f	t	15	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	95	2026-02-13 18:37:36.079761	2026-02-13 18:38:12.533396	4
SIM Spaghetti 500g	20 units per box	{"en": "SIM Spaghetti 500g", "fr": "Spaghetti SIM 500g", "ar": "\\u0633\\u0628\\u0627\\u063a\\u064a\\u062a\\u064a \\u0633\\u064a\\u0645 500\\u063a"}	{"en": "20 units per box", "fr": "20 unit\\u00e9s par carton", "ar": "20 \\u0648\\u062d\\u062f\\u0629 \\u0641\\u064a \\u0627\\u0644\\u0635\\u0646\\u062f\\u0648\\u0642"}	50	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/spaghetti-sim-500g.png	f	t	15	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	96	2026-02-13 18:41:58.650373	\N	4
Sim Tomato Paste 780g	12 units per box	{"en": "Sim Tomato Paste 780g", "fr": "Tomate Sim 780g", "ar": "        \\u0645\\u0639\\u062c\\u0648\\u0646 \\u0637\\u0645\\u0627\\u0637\\u0645 \\u0633\\u064a\\u0645 780\\u063a"}	{"en": "12 units per box", "fr": "12 unit\\u00e9s par carton", "ar": "12 \\u0648\\u062d\\u062f\\u0629 \\u0641\\u064a \\u0627\\u0644\\u0635\\u0646\\u062f\\u0648\\u0642"}	50	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/tomate-sim-780g.png	f	t	17	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	97	2026-02-13 18:46:01.00913	2026-02-13 18:48:09.862088	4
Cevital Sugar 1kg	25 units per box	{"en": "Cevital Sugar 1kg", "fr": "Sucre Cevital 1kg", "ar": "\\u0633\\u0643\\u0631 \\u0633\\u064a\\u0641\\u064a\\u062a\\u0627\\u0644 1\\u0643\\u063a"}	{"en": "25 units per box", "fr": "25 unit\\u00e9s par carton", "ar": "25 \\u0648\\u062d\\u062f\\u0629 \\u0641\\u064a \\u0627\\u0644\\u0635\\u0646\\u062f\\u0648\\u0642"}	87	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/sucre-1kg.png	f	t	12	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	98	2026-02-13 18:54:06.196154	\N	1
Cevital Sugar 2kg	15 units per box	{"en": "Cevital Sugar 2kg", "fr": "Sucre Cevital 2kg", "ar": "\\u0633\\u0643\\u0631 \\u0633\\u064a\\u0641\\u064a\\u062a\\u0627\\u0644 2\\u0643\\u063a"}	{"en": "15 units per box", "fr": "15 unit\\u00e9s par carton", "ar": "15 \\u0648\\u062d\\u062f\\u0629 \\u0641\\u064a \\u0627\\u0644\\u0635\\u0646\\u062f\\u0648\\u0642"}	174	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/sucre-2kg.png	f	t	12	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	99	2026-02-13 18:58:26.810305	\N	1
Cevital Sugar 5kg	5 units per box	{"en": "Cevital Sugar 5kg", "fr": "Sucre Cevital 5kg", "ar": "\\u0633\\u0643\\u0631 \\u0633\\u064a\\u0641\\u064a\\u062a\\u0627\\u0644 5\\u0643\\u063a"}	{"en": "5 units per box", "fr": "5 unit\\u00e9s par carton", "ar": "5 \\u0648\\u062d\\u062f\\u0627\\u062a \\u0641\\u064a \\u0627\\u0644\\u0635\\u0646\\u062f\\u0648\\u0642"}	360	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/sucre-5kg.png	f	t	12	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	100	2026-02-13 19:03:26.990269	\N	1
Cevital Brown Sugar 1kg	20 units per box	{"en": "Cevital Brown Sugar 1kg", "fr": "Sucre Marron Cevital 1kg", "ar": "\\u0633\\u0643\\u0631 \\u0628\\u0646\\u064a \\u0633\\u064a\\u0641\\u064a\\u062a\\u0627\\u0644 1\\u0643\\u063a"}	{"en": "20 units per box", "fr": "20 unit\\u00e9s par carton", "ar": "20 \\u0648\\u062d\\u062f\\u0629 \\u0641\\u064a \\u0627\\u0644\\u0635\\u0646\\u062f\\u0648\\u0642"}	97	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/sucre-marron-1kg.png	f	t	12	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	101	2026-02-13 19:06:14.386869	\N	1
"Cevital Sucre Marron 500g	25 units per box	{"en": "\\"Cevital Sucre Marron 500g", "fr": "Sucre Marron Cevital 500g", "ar": "\\u0633\\u0643\\u0631 \\u0628\\u0646\\u064a \\u0633\\u064a\\u0641\\u064a\\u062a\\u0627\\u0644 500\\u063a"}	{"en": "25 units per box", "fr": "25 unit\\u00e9s par carton", "ar": "25 \\u0648\\u062d\\u062f\\u0629 \\u0641\\u064a \\u0627\\u0644\\u0635\\u0646\\u062f\\u0648\\u0642"}	100	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/sucre-marron-500g.png	f	t	12	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	102	2026-02-13 19:12:42.324838	\N	1
Izdihar Tomato 200g	Izdihar tomato paste in a 200g can, rich and flavorful, perfect for enhancing the color and taste of your sauces, soups, and traditional dishes.	{"en": "Izdihar Tomato 200g", "fr": "Tomate Izdihar 200g", "ar": "\\u0637\\u0645\\u0627\\u0637\\u0645 \\u0625\\u0632\\u062f\\u0647\\u0627\\u0631 200\\u063a"}	{"en": "Izdihar tomato paste in a 200g can, rich and flavorful, perfect for enhancing the color and taste of your sauces, soups, and traditional dishes.", "fr": "Tomate Izdihar en bo\\u00eete de 200g, concentr\\u00e9 de tomate riche et savoureux, id\\u00e9al pour rehausser la couleur et le go\\u00fbt de vos sauces, soupes et plats traditionnels.", "ar": "\\u0645\\u0639\\u062c\\u0648\\u0646 \\u0637\\u0645\\u0627\\u0637\\u0645 \\u0625\\u0632\\u062f\\u0647\\u0627\\u0631 \\u0641\\u064a \\u0639\\u0644\\u0628\\u0629 200\\u063a\\u060c \\u063a\\u0646\\u064a \\u0648\\u0644\\u0630\\u064a\\u0630\\u060c \\u0645\\u062b\\u0627\\u0644\\u064a \\u0644\\u0625\\u0636\\u0627\\u0641\\u0629 \\u0644\\u0648\\u0646 \\u0648\\u0646\\u0643\\u0647\\u0629 \\u0645\\u0645\\u064a\\u0632\\u0629 \\u0644\\u0644\\u0635\\u0644\\u0635\\u0627\\u062a \\u0648\\u0627\\u0644\\u0634\\u0648\\u0631\\u0628\\u0627\\u062a \\u0648\\u0627\\u0644\\u0623\\u0637\\u0628\\u0627\\u0642 \\u0627\\u0644\\u062a\\u0642\\u0644\\u064a\\u062f\\u064a\\u0629."}	120	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/tomate-200g.png	f	t	17	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	120	2026-02-16 12:56:27.102959	\N	2
Pizza Sauce 2.4kg	Pizza sauce in an economical 2.4kg format, made from selected tomatoes for a smooth texture and authentic flavor, perfect for pizzerias and large preparations.	{"en": "Pizza Sauce 2.4kg", "fr": "Sauce Pizza 2.4kg", "ar": "\\u0635\\u0644\\u0635\\u0629 \\u0628\\u064a\\u062a\\u0632\\u0627 2.4\\u0643\\u063a"}	{"en": "Pizza sauce in an economical 2.4kg format, made from selected tomatoes for a smooth texture and authentic flavor, perfect for pizzerias and large preparations.", "fr": "Sauce pizza en format \\u00e9conomique de 2.4kg, pr\\u00e9par\\u00e9e \\u00e0 partir de tomates s\\u00e9lectionn\\u00e9es pour une texture onctueuse et une saveur authentique, id\\u00e9ale pour les pizzerias et les grandes pr\\u00e9parations.", "ar": "\\u0635\\u0644\\u0635\\u0629 \\u0628\\u064a\\u062a\\u0632\\u0627 \\u0628\\u062d\\u062c\\u0645 \\u0627\\u0642\\u062a\\u0635\\u0627\\u062f\\u064a 2.4\\u0643\\u063a\\u060c \\u0645\\u0635\\u0646\\u0648\\u0639\\u0629 \\u0645\\u0646 \\u0637\\u0645\\u0627\\u0637\\u0645 \\u0645\\u062e\\u062a\\u0627\\u0631\\u0629 \\u0628\\u0642\\u0648\\u0627\\u0645 \\u0646\\u0627\\u0639\\u0645 \\u0648\\u0646\\u0643\\u0647\\u0629 \\u0623\\u0635\\u0644\\u064a\\u0629\\u060c \\u0645\\u062b\\u0627\\u0644\\u064a\\u0629 \\u0644\\u0644\\u0645\\u0637\\u0627\\u0639\\u0645 \\u0648\\u0627\\u0644\\u062a\\u062d\\u0636\\u064a\\u0631\\u0627\\u062a \\u0627\\u0644\\u0643\\u0628\\u064a\\u0631\\u0629"}	280	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/sauce-pizza-2.4kg.png	f	t	17	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	119	2026-02-16 12:51:14.452094	\N	2
Harissa 760g	Spicy and flavorful harissa made from carefully selected red chili peppers, perfect for enhancing traditional dishes, sauces, and marinades.	{"en": "Harissa 760g", "fr": "Harissa 760g", "ar": "\\u0647\\u0631\\u064a\\u0633\\u0629 760\\u063a"}	{"en": "Spicy and flavorful harissa made from carefully selected red chili peppers, perfect for enhancing traditional dishes, sauces, and marinades.", "fr": "Harissa piquante et savoureuse pr\\u00e9par\\u00e9e \\u00e0 base de piments rouges soigneusement s\\u00e9lectionn\\u00e9s, id\\u00e9ale pour relever vos plats traditionnels, sauces et marinades.", "ar": "\\u0647\\u0631\\u064a\\u0633\\u0629 \\u062d\\u0627\\u0631\\u0629 \\u0648\\u0644\\u0630\\u064a\\u0630\\u0629 \\u0645\\u0635\\u0646\\u0648\\u0639\\u0629 \\u0645\\u0646 \\u0641\\u0644\\u0641\\u0644 \\u0623\\u062d\\u0645\\u0631 \\u0645\\u062e\\u062a\\u0627\\u0631 \\u0628\\u0639\\u0646\\u0627\\u064a\\u0629\\u060c \\u0645\\u062b\\u0627\\u0644\\u064a\\u0629 \\u0644\\u0625\\u0636\\u0627\\u0641\\u0629 \\u0646\\u0643\\u0647\\u0629 \\u0645\\u0645\\u064a\\u0632\\u0629 \\u0644\\u0644\\u0623\\u0637\\u0628\\u0627\\u0642 \\u0627\\u0644\\u062a\\u0642\\u0644\\u064a\\u062f\\u064a\\u0629 \\u0648\\u0627\\u0644\\u0635\\u0644\\u0635\\u0627\\u062a \\u0648\\u0627\\u0644\\u062a\\u062a\\u0628\\u064a\\u0644\\u0627\\u062a."}	180	PIECE	500	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/harissa-760g.png	f	t	19	{"type": "range", "min": 5, "max": 100, "step": 15, "pills": [15, 30, 45]}	48	2026-02-13 13:07:28.254216	2026-02-13 16:29:35.979107	2
LaBelle Couscous 1kg	10 units per box	{"en": "LaBelle Couscous 1kg", "fr": "Couscous LaBelle 1kg", "ar": "\\u0643\\u0633\\u0643\\u0633 \\u0644\\u0627\\u0628\\u064a\\u0644 1\\u0643\\u063a"}	{"en": "10 units per box", "fr": "10 unit\\u00e9s par carton", "ar": "10 \\u0648\\u062d\\u062f\\u0629 \\u0641\\u064a \\u0627\\u0644\\u0635\\u0646\\u062f\\u0648\\u0642"}	75	KG	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/couscous-labelle-1kg.png	f	t	15	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	84	2026-02-13 17:04:54.761989	\N	3
LaBelle Rice 1kg	10 units per box	{"en": "LaBelle Rice 1kg", "fr": "Riz LaBelle 1kg", "ar": "\\u0623\\u0631\\u0632 \\u0644\\u0627\\u0628\\u064a\\u0644 1\\u0643\\u063a"}	{"en": "10 units per box", "fr": "10 unit\\u00e9s par carton", "ar": "10 \\u0648\\u062d\\u062f\\u0629 \\u0641\\u064a \\u0627\\u0644\\u0635\\u0646\\u062f\\u0648\\u0642"}	85	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/riz-labelle-1kg.png	f	t	15	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	86	2026-02-13 17:18:44.109097	\N	3
LaBelle Rice 500g	20 units per box	{"en": "LaBelle Rice 500g", "fr": "Riz LaBelle 500g", "ar": "\\u0623\\u0631\\u0632 \\u0644\\u0627\\u0628\\u064a\\u0644 500\\u063a"}	{"en": "20 units per box", "fr": "20 unit\\u00e9s par carton", "ar": "20 \\u0648\\u062d\\u062f\\u0629 \\u0641\\u064a \\u0627\\u0644\\u0635\\u0646\\u062f\\u0648\\u0642"}	80	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/riz-labelle-500g.png	f	t	15	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	87	2026-02-13 17:24:53.324851	\N	3
LaBelle Golden Rice 1kg	10 units per box	{"en": "LaBelle Golden Rice 1kg", "fr": "Riz LaBelle Golden 1kg", "ar": "\\u0623\\u0631\\u0632 \\u0644\\u0627\\u0628\\u064a\\u0644 \\u062c\\u0648\\u0644\\u062f\\u0646 1\\u0643\\u063a"}	{"en": "10 units per box", "fr": "10 unit\\u00e9s par carton", "ar": "10 \\u0648\\u062d\\u062f\\u0629 \\u0641\\u064a \\u0627\\u0644\\u0635\\u0646\\u062f\\u0648\\u0642"}	80	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/riz-labelle-golden-1kg.png	f	t	15	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	88	2026-02-13 17:30:07.518836	\N	3
LaBelle Sugar 1kg	25 units per box	{"en": "LaBelle Sugar 1kg", "fr": "Sucre LaBelle 1kg", "ar": "\\u0633\\u0643\\u0631 \\u0644\\u0627\\u0628\\u064a\\u0644 1\\u0643\\u063a"}	{"en": "25 units per box", "fr": "25 unit\\u00e9s par carton", "ar": "25 \\u0648\\u062d\\u062f\\u0629 \\u0641\\u064a \\u0627\\u0644\\u0635\\u0646\\u062f\\u0648\\u0642"}	95	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/sucre-labelle-1kg.png	f	t	12	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	89	2026-02-13 17:34:27.896884	\N	3
Mama Couscous 900g	12 units per box	{"en": "Mama Couscous 900g", "fr": "Couscous Mama 900g", "ar": "\\u0643\\u0633\\u0643\\u0633 \\u0645\\u0627\\u0645\\u0627 900\\u063a"}	{"en": "12 units per box", "fr": "12 unit\\u00e9s par carton", "ar": "        12 \\u0648\\u062d\\u062f\\u0629 \\u0641\\u064a \\u0627\\u0644\\u0635\\u0646\\u062f\\u0648\\u0642"}	90	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/couscous-900g.png	f	t	15	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	90	2026-02-13 18:07:32.731917	\N	5
Mama Macaroni 500g	20 units per box	{"en": "Mama Macaroni 500g", "fr": "Macaron Mama 500g", "ar": "        \\u0645\\u0643\\u0631\\u0648\\u0646\\u0629 \\u0645\\u0627\\u0645\\u0627 500\\u063a"}	{"en": "20 units per box", "fr": "20 unit\\u00e9s par carton", "ar": "       20 \\u0648\\u062d\\u062f\\u0629 \\u0641\\u064a \\u0627\\u0644\\u0635\\u0646\\u062f\\u0648\\u0642"}	50	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/macaron-p-500g.png	f	t	15	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	92	2026-02-13 18:20:41.111404	\N	5
Mama Macaroni 500g	20 units per box	{"en": "Mama Macaroni 500g", "fr": "Macaron Mama 500g", "ar": "        \\u0645\\u0643\\u0631\\u0648\\u0646\\u0629 \\u0645\\u0627\\u0645\\u0627 500\\u063a"}	{"en": "20 units per box", "fr": "20 unit\\u00e9s par carton", "ar": "       20 \\u0648\\u062d\\u062f\\u0629 \\u0641\\u064a \\u0627\\u0644\\u0635\\u0646\\u062f\\u0648\\u0642"}	50	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/macaron-m-500g.png	f	t	15	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	91	2026-02-13 18:14:36.481201	2026-02-13 18:20:59.64186	5
Mama Macaroni 500g	20 units per box	{"en": "Mama Macaroni 500g", "fr": "Macaron Mama 500g", "ar": "        \\u0645\\u0643\\u0631\\u0648\\u0646\\u0629 \\u0645\\u0627\\u0645\\u0627 500\\u063a"}	{"en": "20 units per box", "fr": "20 unit\\u00e9s par carton", "ar": "       20 \\u0648\\u062d\\u062f\\u0629 \\u0641\\u064a \\u0627\\u0644\\u0635\\u0646\\u062f\\u0648\\u0642"}	50	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/macaron-p-p-500g.png	f	t	15	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	93	2026-02-13 18:25:02.779394	\N	5
Mama Penne 500g	20 units per box	{"en": "Mama Penne 500g", "fr": "Penne Mama 500g", "ar": "\\u0628\\u064a\\u0646\\u064a \\u0645\\u0627\\u0645\\u0627 500\\u063a"}	{"en": "20 units per box", "fr": "20 unit\\u00e9s par carton", "ar": "       20 \\u0648\\u062d\\u062f\\u0629 \\u0641\\u064a \\u0627\\u0644\\u0635\\u0646\\u062f\\u0648\\u0642"}	50	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/penne-500g.png	f	t	15	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	94	2026-02-13 18:30:12.866408	\N	5
Cevital Apricot Jam 400g	24 units per box	{"en": "Cevital Apricot Jam 400g", "fr": "Confiture Abricots Cevital 400g", "ar": "\\u0645\\u0631\\u0628\\u0649 \\u0627\\u0644\\u0645\\u0634\\u0645\\u0634 \\u0633\\u064a\\u0641\\u064a\\u062a\\u0627\\u0644 400\\u063a"}	{"en": "24 units per box", "fr": "24 unit\\u00e9s par carton", "ar": "24 \\u0648\\u062d\\u062f\\u0629 \\u0641\\u064a \\u0627\\u0644\\u0635\\u0646\\u062f\\u0648\\u0642"}	110	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/confiture-abricots-400g.png	f	t	18	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	103	2026-02-13 19:16:18.387693	\N	1
Cevital Apricot Jam 800g	12 units per box	{"en": "Cevital Apricot Jam 800g", "fr": "Confiture Abricots Cevital 800g", "ar": "\\u0645\\u0631\\u0628\\u0649 \\u0627\\u0644\\u0645\\u0634\\u0645\\u0634 \\u0633\\u064a\\u0641\\u064a\\u062a\\u0627\\u0644 800\\u063a"}	{"en": "12 units per box", "fr": "12 unit\\u00e9s par carton", "ar": "12 \\u0648\\u062d\\u062f\\u0629 \\u0641\\u064a \\u0627\\u0644\\u0635\\u0646\\u062f\\u0648\\u0642"}	215	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/confiture-abricots-800g.png	f	t	18	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	104	2026-02-13 19:22:13.022543	\N	1
Cevital Sugar Cubes	Cevital sugar cubes in a 750g box, perfect for coffee, tea, and all your hot beverages with convenient portioning.	{"en": "Cevital Sugar Cubes", "fr": "Sucre en morceaux", "ar": "\\u0633\\u0643\\u0631 \\u0645\\u0643\\u0639\\u0628\\u0627\\u062a"}	{"en": "Cevital sugar cubes in a 750g box, perfect for coffee, tea, and all your hot beverages with convenient portioning.", "fr": "Sucre en morceaux Cevital en bo\\u00eete de 750g, id\\u00e9al pour accompagner le caf\\u00e9, le th\\u00e9 et toutes vos boissons chaudes avec un dosage pratique.", "ar": "\\u0633\\u0643\\u0631 \\u0645\\u0643\\u0639\\u0628\\u0627\\u062a \\u0645\\u0646 \\u0633\\u064a\\u0641\\u064a\\u062a\\u0627\\u0644 \\u0641\\u064a \\u0639\\u0644\\u0628\\u0629 750\\u063a\\u060c \\u0645\\u062b\\u0627\\u0644\\u064a \\u0644\\u0644\\u0642\\u0647\\u0648\\u0629 \\u0648\\u0627\\u0644\\u0634\\u0627\\u064a \\u0648\\u062c\\u0645\\u064a\\u0639 \\u0645\\u0634\\u0631\\u0648\\u0628\\u0627\\u062a\\u0643 \\u0627\\u0644\\u0633\\u0627\\u062e\\u0646\\u0629 \\u0628\\u062c\\u0631\\u0639\\u0627\\u062a \\u0639\\u0645\\u0644\\u064a\\u0629."}	75	PIECE	500	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/sucre-morceaux-750g.png	f	t	12	null	47	2026-02-13 12:26:53.216918	2026-02-15 10:29:51.980754	1
LaBelle Beans 900g	12 units per box	{"en": "LaBelle Beans 900g", "fr": "Haricots LaBelle 900g", "ar": "\\u0641\\u0627\\u0635\\u0648\\u0644\\u064a\\u0627 \\u0644\\u0627\\u0628\\u064a\\u0644 900\\u063a"}	{"en": "12 units per box", "fr": "12 unit\\u00e9s par carton", "ar": "12 \\u0648\\u062d\\u062f\\u0629 \\u0641\\u064a \\u0627\\u0644\\u0635\\u0646\\u062f\\u0648\\u0642"}	95	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/haricots-labelle-900g.png	f	t	15	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	85	2026-02-13 17:14:07.425195	2026-02-15 10:31:30.088588	3
Elio Cevital Oil 1L	Elio Cevital 1 liter cooking oil, perfect for daily cooking, frying, and seasoning	{"en": "Elio Cevital Oil 1L", "fr": "Huile Elio Cevital 1L", "ar": "\\u0632\\u064a\\u062a \\u0625\\u0644\\u064a\\u0648 \\u0633\\u064a\\u0641\\u064a\\u062a\\u0627\\u0644 1 \\u0644\\u062a\\u0631"}	{"en": "Elio Cevital 1 liter cooking oil, perfect for daily cooking, frying, and seasoning", "fr": "Huile de table Elio de Cevital 1 litre, id\\u00e9ale pour la cuisson, la friture et l\\u2019assaisonnement au quotidien.", "ar": "\\u0632\\u064a\\u062a \\u0625\\u0644\\u064a\\u0648 \\u0633\\u064a\\u0641\\u064a\\u062a\\u0627\\u0644 1 \\u0644\\u062a\\u0631\\u060c \\u0645\\u062b\\u0627\\u0644\\u064a \\u0644\\u0644\\u0637\\u0628\\u062e \\u0627\\u0644\\u064a\\u0648\\u0645\\u064a \\u0648\\u0627\\u0644\\u0642\\u0644\\u064a \\u0648\\u0627\\u0644\\u062a\\u062a\\u0628\\u064a\\u0644"}	110	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/elio-1l.png	f	t	21	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	105	2026-02-15 13:19:56.52127	\N	1
Elio Cevital Oil 5L	Cevital Elio vegetable oil in a 5-liter bottle, light and versatile, perfect for frying, cooking, and everyday seasoning.	{"en": "Elio Cevital Oil 5L", "fr": "Huile Elio Cevital 5L", "ar": "\\u0632\\u064a\\u062a \\u0625\\u0644\\u064a\\u0648 \\u0633\\u064a\\u0641\\u064a\\u062a\\u0627\\u0644 5 \\u0644\\u062a\\u0631"}	{"en": "Cevital Elio vegetable oil in a 5-liter bottle, light and versatile, perfect for frying, cooking, and everyday seasoning.", "fr": "Huile v\\u00e9g\\u00e9tale Cevital Elio en bouteille de 5 litres, l\\u00e9g\\u00e8re et polyvalente, id\\u00e9ale pour la friture, la cuisson et l\\u2019assaisonnement au quotidien.", "ar": "\\u0632\\u064a\\u062a \\u0646\\u0628\\u0627\\u062a\\u064a \\u0633\\u064a\\u0641\\u064a\\u062a\\u0627\\u0644  \\u0625\\u0644\\u064a\\u0648 \\u0641\\u064a \\u0642\\u0627\\u0631\\u0648\\u0631\\u0629 5 \\u0644\\u062a\\u0631\\u060c \\u062e\\u0641\\u064a\\u0641 \\u0648\\u0645\\u062a\\u0639\\u062f\\u062f \\u0627\\u0644\\u0627\\u0633\\u062a\\u0639\\u0645\\u0627\\u0644\\u0627\\u062a\\u060c \\u0645\\u062b\\u0627\\u0644\\u064a \\u0644\\u0644\\u0642\\u0644\\u064a \\u0648\\u0627\\u0644\\u0637\\u0647\\u064a \\u0648\\u0627\\u0644\\u062a\\u062a\\u0628\\u064a\\u0644 \\u0627\\u0644\\u064a\\u0648\\u0645\\u064a."}	550	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/elio-5l.png	f	t	21	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	107	2026-02-15 22:02:37.835124	2026-02-15 22:07:38.203775	1
Elio Cevital Oil 2L	Elio Cevital 2 liter cooking oil, perfect for daily cooking, frying, and seasoning	{"en": "Elio Cevital Oil 2L", "fr": "Huile Elio Cevital 2L", "ar": "\\u0632\\u064a\\u062a \\u0625\\u0644\\u064a\\u0648 \\u0633\\u064a\\u0641\\u064a\\u062a\\u0627\\u0644 2 \\u0644\\u062a\\u0631"}	{"en": "Elio Cevital 2 liter cooking oil, perfect for daily cooking, frying, and seasoning", "fr": "Huile de table Elio de Cevital 2 litre, id\\u00e9ale pour la cuisson, la friture et l\\u2019assaisonnement au quotidien.", "ar": "\\u0632\\u064a\\u062a \\u0625\\u0644\\u064a\\u0648 \\u0633\\u064a\\u0641\\u064a\\u062a\\u0627\\u0644 2 \\u0644\\u062a\\u0631\\u060c \\u0645\\u062b\\u0627\\u0644\\u064a \\u0644\\u0644\\u0637\\u0628\\u062e \\u0627\\u0644\\u064a\\u0648\\u0645\\u064a \\u0648\\u0627\\u0644\\u0642\\u0644\\u064a \\u0648\\u0627\\u0644\\u062a\\u062a\\u0628\\u064a\\u0644"}	250	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/elio-2l.png	f	t	21	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	108	2026-02-15 22:11:05.620129	\N	1
Avril Tomato 800g	Avril canned tomato 800g, made from selected tomatoes to provide rich flavor and perfect texture for sauces, stews, and traditional recipes.	{"en": "Avril Tomato 800g", "fr": "Tomate Avril 800g", "ar": "\\u0637\\u0645\\u0627\\u0637\\u0645 \\u0623\\u0641\\u0631\\u064a\\u0644 800\\u063a"}	{"en": "Avril canned tomato 800g, made from selected tomatoes to provide rich flavor and perfect texture for sauces, stews, and traditional recipes.", "fr": "Tomate Avril en bo\\u00eete de 800g, pr\\u00e9par\\u00e9e \\u00e0 partir de tomates s\\u00e9lectionn\\u00e9es pour une saveur riche et une texture id\\u00e9ale pour vos sauces, plats mijot\\u00e9s et recettes traditionnelles.", "ar": "\\u0637\\u0645\\u0627\\u0637\\u0645 \\u0623\\u0641\\u0631\\u064a\\u0644 \\u0645\\u0639\\u0644\\u0628\\u0629 800\\u063a\\u060c \\u0645\\u0635\\u0646\\u0648\\u0639\\u0629 \\u0645\\u0646 \\u0637\\u0645\\u0627\\u0637\\u0645 \\u0645\\u062e\\u062a\\u0627\\u0631\\u0629 \\u0644\\u062a\\u0645\\u0646\\u062d \\u0646\\u0643\\u0647\\u0629 \\u063a\\u0646\\u064a\\u0629 \\u0648\\u0642\\u0648\\u0627\\u0645\\u0627\\u064b \\u0645\\u062b\\u0627\\u0644\\u064a\\u0627\\u064b \\u0644\\u0644\\u0635\\u0644\\u0635\\u0627\\u062a \\u0648\\u0627\\u0644\\u0623\\u0637\\u0628\\u0627\\u0642 \\u0627\\u0644\\u062a\\u0642\\u0644\\u064a\\u062f\\u064a\\u0629"}	170	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/tomate-avril-800g.png	f	t	17	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	109	2026-02-15 22:28:05.409701	\N	6
Cevital Afia Oil 2L	Cevital Afia vegetable oil in a 2-liter bottle, light and versatile, perfect for frying, cooking, and everyday seasoning.	{"en": "Cevital Afia Oil 2L", "fr": "Huile Afia Cevital 2L", "ar": "\\u0632\\u064a\\u062a \\u0633\\u064a\\u0641\\u064a\\u062a\\u0627\\u0644 \\u0639\\u0627\\u0641\\u064a\\u0629 2\\u0644\\u062a\\u0631"}	{"en": "Cevital Afia vegetable oil in a 2-liter bottle, light and versatile, perfect for frying, cooking, and everyday seasoning.", "fr": "Huile v\\u00e9g\\u00e9tale Cevital Afia en bouteille de 2 litres, l\\u00e9g\\u00e8re et polyvalente, id\\u00e9ale pour la friture, la cuisson et l\\u2019assaisonnement au quotidien.", "ar": "\\u0632\\u064a\\u062a \\u0646\\u0628\\u0627\\u062a\\u064a \\u0633\\u064a\\u0641\\u064a\\u062a\\u0627\\u0644 \\u0639\\u0627\\u0641\\u064a\\u0629 \\u0641\\u064a \\u0642\\u0627\\u0631\\u0648\\u0631\\u0629 2 \\u0644\\u062a\\u0631\\u060c \\u062e\\u0641\\u064a\\u0641 \\u0648\\u0645\\u062a\\u0639\\u062f\\u062f \\u0627\\u0644\\u0627\\u0633\\u062a\\u0639\\u0645\\u0627\\u0644\\u0627\\u062a\\u060c \\u0645\\u062b\\u0627\\u0644\\u064a \\u0644\\u0644\\u0642\\u0644\\u064a \\u0648\\u0627\\u0644\\u0637\\u0647\\u064a \\u0648\\u0627\\u0644\\u062a\\u062a\\u0628\\u064a\\u0644 \\u0627\\u0644\\u064a\\u0648\\u0645\\u064a."}	240	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/afia-2l.png	f	t	21	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	106	2026-02-15 21:55:36.310075	2026-02-15 22:03:52.792871	1
Avril Tomato 400g	Avril canned tomato 400g, made from selected tomatoes to provide rich flavor and perfect texture for sauces, stews, and traditional recipes.	{"en": "Avril Tomato 400g", "fr": "Tomate Avril 400g", "ar": "\\u0637\\u0645\\u0627\\u0637\\u0645 \\u0623\\u0641\\u0631\\u064a\\u0644 400\\u063a"}	{"en": "Avril canned tomato 400g, made from selected tomatoes to provide rich flavor and perfect texture for sauces, stews, and traditional recipes.", "fr": "Tomate Avril en bo\\u00eete de 400g, pr\\u00e9par\\u00e9e \\u00e0 partir de tomates s\\u00e9lectionn\\u00e9es pour une saveur riche et une texture id\\u00e9ale pour vos sauces, plats mijot\\u00e9s et recettes traditionnelles.", "ar": "\\u0637\\u0645\\u0627\\u0637\\u0645 \\u0623\\u0641\\u0631\\u064a\\u0644 \\u0645\\u0639\\u0644\\u0628\\u0629 400\\u063a\\u060c \\u0645\\u0635\\u0646\\u0648\\u0639\\u0629 \\u0645\\u0646 \\u0637\\u0645\\u0627\\u0637\\u0645 \\u0645\\u062e\\u062a\\u0627\\u0631\\u0629 \\u0644\\u062a\\u0645\\u0646\\u062d \\u0646\\u0643\\u0647\\u0629 \\u063a\\u0646\\u064a\\u0629 \\u0648\\u0642\\u0648\\u0627\\u0645\\u0627\\u064b \\u0645\\u062b\\u0627\\u0644\\u064a\\u0627\\u064b \\u0644\\u0644\\u0635\\u0644\\u0635\\u0627\\u062a \\u0648\\u0627\\u0644\\u0623\\u0637\\u0628\\u0627\\u0642 \\u0627\\u0644\\u062a\\u0642\\u0644\\u064a\\u062f\\u064a\\u0629"}	120	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/tomate-avril-400g.png	f	t	17	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	110	2026-02-15 22:33:49.296507	\N	6
LaBelle Flour 1kg	Premium LaBelle flour in a 1kg bag, perfect for baking bread, cakes, pancakes, and all your homemade recipes.	{"en": "LaBelle Flour 1kg", "fr": "Farine LaBelle 1kg", "ar": "\\u0641\\u0631\\u064a\\u0646\\u0629 \\u0644\\u0627\\u0628\\u0644 1\\u0643\\u063a"}	{"en": "Premium LaBelle flour in a 1kg bag, perfect for baking bread, cakes, pancakes, and all your homemade recipes.", "fr": "Farine LaBelle de qualit\\u00e9 sup\\u00e9rieure en sachet de 1kg, id\\u00e9ale pour la pr\\u00e9paration du pain, des g\\u00e2teaux, des cr\\u00eapes et de toutes vos recettes maison.", "ar": ""}	48	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/farine-labelle.png	f	t	13	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	111	2026-02-15 22:39:11.186242	\N	3
Farine Sim 1kg	Sim flour in a 1kg bag, fine and high quality, perfect for baking bread, pastries, pancakes, and everyday recipes.	{"en": "Farine Sim 1kg", "fr": "Sim Flour 1kg", "ar": "\\u0641\\u0631\\u064a\\u0646\\u0629 \\u0633\\u064a\\u0645 1\\u0643\\u063a"}	{"en": "Sim flour in a 1kg bag, fine and high quality, perfect for baking bread, pastries, pancakes, and everyday recipes.", "fr": "Farine Sim en sachet de 1kg, fine et de qualit\\u00e9, id\\u00e9ale pour la pr\\u00e9paration du pain, des p\\u00e2tisseries, des cr\\u00eapes et de toutes vos recettes quotidiennes.", "ar": "\\u0641\\u0631\\u064a\\u0646\\u0629 \\u0633\\u064a\\u0645 \\u0641\\u064a \\u0643\\u064a\\u0633 1\\u0643\\u063a \\u0646\\u0627\\u0639\\u0645\\u0629 \\u0648\\u0639\\u0627\\u0644\\u064a\\u0629 \\u0627\\u0644\\u062c\\u0648\\u062f\\u0629\\u060c \\u0645\\u062b\\u0627\\u0644\\u064a\\u0629 \\u0644\\u062a\\u062d\\u0636\\u064a\\u0631 \\u0627\\u0644\\u062e\\u0628\\u0632 \\u0648\\u0627\\u0644\\u062d\\u0644\\u0648\\u064a\\u0627\\u062a \\u0648\\u0627\\u0644\\u0641\\u0637\\u0627\\u0626\\u0631 \\u0648\\u062c\\u0645\\u064a\\u0639 \\u0648\\u0635\\u0641\\u0627\\u062a\\u0643 \\u0627\\u0644\\u064a\\u0648\\u0645\\u064a\\u0629"}	45	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/farine-sim-1kg.png	f	t	13	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	113	2026-02-15 22:50:04.274072	\N	4
Avril Harissa 135g	"Avril harissa in a 135g can, made from selected red chili peppers for a strong and spicy flavor, perfect with couscous, meats, and traditional dishes.	{"en": "Avril Harissa 135g", "fr": "Harissa Avril 135g", "ar": "\\u0647\\u0631\\u064a\\u0633\\u0629 \\u0623\\u0641\\u0631\\u064a\\u0644 135\\u063a"}	{"en": "\\"Avril harissa in a 135g can, made from selected red chili peppers for a strong and spicy flavor, perfect with couscous, meats, and traditional dishes.", "fr": "Harissa Avril en bo\\u00eete de 135g, pr\\u00e9par\\u00e9e \\u00e0 base de piments rouges s\\u00e9lectionn\\u00e9s pour une saveur intense et relev\\u00e9e, id\\u00e9ale pour accompagner couscous, viandes et plats traditionnels.", "ar": "\\u0647\\u0631\\u064a\\u0633\\u0629 \\u0623\\u0641\\u0631\\u064a\\u0644 \\u0641\\u064a \\u0639\\u0644\\u0628\\u0629 135\\u063a\\u060c \\u0645\\u0635\\u0646\\u0648\\u0639\\u0629 \\u0645\\u0646 \\u0641\\u0644\\u0641\\u0644 \\u0623\\u062d\\u0645\\u0631 \\u0645\\u062e\\u062a\\u0627\\u0631 \\u0644\\u0646\\u0643\\u0647\\u0629 \\u0642\\u0648\\u064a\\u0629 \\u0648\\u062d\\u0627\\u0631\\u0629\\u060c \\u0645\\u062b\\u0627\\u0644\\u064a\\u0629 \\u0645\\u0639 \\u0627\\u0644\\u0643\\u0633\\u0643\\u0633 \\u0648\\u0627\\u0644\\u0644\\u062d\\u0648\\u0645 \\u0648\\u0627\\u0644\\u0623\\u0637\\u0628\\u0627\\u0642 \\u0627\\u0644\\u062a\\u0642\\u0644\\u064a\\u062f\\u064a\\u0629."}	55	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/harissa-avril-135g.png	f	t	19	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	114	2026-02-15 22:55:26.62059	\N	6
Mama Flour 1kg	Mama flour in a 1kg bag, fine and versatile, perfect for baking bread, cakes, pasta, and all your homemade recipes.	{"en": "Mama Flour 1kg", "fr": "Farine Mama 1kg", "ar": "\\u0641\\u0631\\u064a\\u0646\\u0629 \\u0645\\u0627\\u0645\\u0627 1\\u0643\\u063a"}	{"en": "Mama flour in a 1kg bag, fine and versatile, perfect for baking bread, cakes, pasta, and all your homemade recipes.", "fr": "Farine Mama en sachet de 1kg, fine et polyvalente, id\\u00e9ale pour la pr\\u00e9paration du pain, des g\\u00e2teaux, des p\\u00e2tes et de toutes vos recettes maison.", "ar": "\\u0641\\u0631\\u064a\\u0646\\u0629 \\u0645\\u0627\\u0645\\u0627 \\u0641\\u064a \\u0643\\u064a\\u0633\\u0646\\u0627\\u0639\\u0645\\u0629 \\u0648\\u0645\\u062a\\u0639\\u062f\\u062f\\u0629 \\u0627\\u0644\\u0627\\u0633\\u062a\\u0639\\u0645\\u0627\\u0644\\u0627\\u062a\\u060c \\u0645\\u062b\\u0627\\u0644\\u064a\\u0629 \\u0644\\u062a\\u062d\\u0636\\u064a\\u0631 \\u0627\\u0644\\u062e\\u0628\\u0632 \\u0648\\u0627\\u0644\\u0643\\u0639\\u0643 \\u0648\\u0627\\u0644\\u0645\\u0639\\u062c\\u0646\\u0627\\u062a \\u0648\\u062c\\u0645\\u064a\\u0639 \\u0648\\u0635\\u0641\\u0627\\u062a\\u0643 \\u0627\\u0644\\u0645\\u0646\\u0632\\u0644\\u064a\\u0629"}	45	PIECE	10	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/farine-mama-1kg.png	f	t	13	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	112	2026-02-15 22:44:41.962211	\N	5
Avril Harissa 760g	"Avril harissa in a 760g can, made from selected red chili peppers for a strong and spicy flavor, perfect with couscous, meats, and traditional dishes.	{"en": "Avril Harissa 760g", "fr": "Harissa Avril 760g", "ar": "\\u0647\\u0631\\u064a\\u0633\\u0629 \\u0623\\u0641\\u0631\\u064a\\u0644 760\\u063a"}	{"en": "\\"Avril harissa in a 760g can, made from selected red chili peppers for a strong and spicy flavor, perfect with couscous, meats, and traditional dishes.", "fr": "Harissa Avril en bo\\u00eete de 760g, pr\\u00e9par\\u00e9e \\u00e0 base de piments rouges s\\u00e9lectionn\\u00e9s pour une saveur intense et relev\\u00e9e, id\\u00e9ale pour accompagner couscous, viandes et plats traditionnels.", "ar": "\\u0647\\u0631\\u064a\\u0633\\u0629 \\u0623\\u0641\\u0631\\u064a\\u0644 \\u0641\\u064a \\u0639\\u0644\\u0628\\u0629 760\\u063a\\u060c \\u0645\\u0635\\u0646\\u0648\\u0639\\u0629 \\u0645\\u0646 \\u0641\\u0644\\u0641\\u0644 \\u0623\\u062d\\u0645\\u0631 \\u0645\\u062e\\u062a\\u0627\\u0631 \\u0644\\u0646\\u0643\\u0647\\u0629 \\u0642\\u0648\\u064a\\u0629 \\u0648\\u062d\\u0627\\u0631\\u0629\\u060c \\u0645\\u062b\\u0627\\u0644\\u064a\\u0629 \\u0645\\u0639 \\u0627\\u0644\\u0643\\u0633\\u0643\\u0633 \\u0648\\u0627\\u0644\\u0644\\u062d\\u0648\\u0645 \\u0648\\u0627\\u0644\\u0623\\u0637\\u0628\\u0627\\u0642 \\u0627\\u0644\\u062a\\u0642\\u0644\\u064a\\u062f\\u064a\\u0629."}	110	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/harissa-avril-760g.png	f	t	19	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	115	2026-02-15 23:02:58.494191	\N	6
1001 Coffee 250g	1001 ground coffee in a 250g pack, with rich taste and intense aroma, perfect to start your day with a flavorful and balanced coffee.	{"en": "1001 Coffee 250g", "fr": "1001 Caf\\u00e9 250g", "ar": "1001 \\u0642\\u0647\\u0648\\u0629 250\\u063a"}	{"en": "1001 ground coffee in a 250g pack, with rich taste and intense aroma, perfect to start your day with a flavorful and balanced coffee.", "fr": "001 Caf\\u00e9 moulu en paquet de 250g, au go\\u00fbt riche et ar\\u00f4me intense, id\\u00e9al pour bien commencer la journ\\u00e9e avec un caf\\u00e9 savoureux et \\u00e9quilibr\\u00e9.", "ar": "\\u0642\\u0647\\u0648\\u0629 1001 \\u0645\\u0637\\u062d\\u0648\\u0646\\u0629 \\u0641\\u064a \\u0639\\u0628\\u0648\\u0629 250\\u063a\\u060c \\u0628\\u0637\\u0639\\u0645 \\u063a\\u0646\\u064a \\u0648\\u0631\\u0627\\u0626\\u062d\\u0629 \\u0642\\u0648\\u064a\\u0629\\u060c \\u0645\\u062b\\u0627\\u0644\\u064a\\u0629 \\u0644\\u0628\\u062f\\u0621 \\u064a\\u0648\\u0645\\u0643 \\u0628\\u0642\\u0647\\u0648\\u0629 \\u0644\\u0630\\u064a\\u0630\\u0629 \\u0648\\u0645\\u062a\\u0648\\u0627\\u0632\\u0646\\u0629."}	250	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/1001-cafe-250g.png	f	t	11	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	116	2026-02-15 23:18:34.309963	\N	6
1001 Gold Coffee 250g	1001 Gold coffee in a 250g pack, refined blend with intense taste and rich aroma, perfect for lovers of strong and flavorful coffee.	{"en": "1001 Gold Coffee 250g", "fr": "1001 Caf\\u00e9 Gold 250g", "ar": "1001 \\u0642\\u0647\\u0648\\u0629 \\u063a\\u0648\\u0644\\u062f 250\\u063a"}	{"en": "1001 Gold coffee in a 250g pack, refined blend with intense taste and rich aroma, perfect for lovers of strong and flavorful coffee.", "fr": "001 Caf\\u00e9 Gold en paquet de 250g, m\\u00e9lange raffin\\u00e9 au go\\u00fbt intense et ar\\u00f4me riche, id\\u00e9al pour les amateurs de caf\\u00e9 cors\\u00e9 et savoureux.", "ar": "\\u0642\\u0647\\u0648\\u0629 1001 \\u063a\\u0648\\u0644\\u062f \\u0641\\u064a \\u0639\\u0628\\u0648\\u0629 250\\u063a\\u060c \\u0645\\u0632\\u064a\\u062c \\u0631\\u0627\\u0642\\u064d \\u0628\\u0637\\u0639\\u0645 \\u0642\\u0648\\u064a \\u0648\\u0631\\u0627\\u0626\\u062d\\u0629 \\u063a\\u0646\\u064a\\u0629\\u060c \\u0645\\u062b\\u0627\\u0644\\u064a\\u0629 \\u0644\\u0639\\u0634\\u0627\\u0642 \\u0627\\u0644\\u0642\\u0647\\u0648\\u0629 \\u0627\\u0644\\u0645\\u0631\\u0643\\u0632\\u0629 \\u0648\\u0627\\u0644\\u0644\\u0630\\u064a\\u0630\\u0629"}	250	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/1001-cafe-gold-250g.png	f	t	11	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	117	2026-02-15 23:29:15.459861	2026-02-15 23:31:41.496674	6
Bimo Cookies 60g	"Bimo cookies in a 60g pack, soft biscuits with chocolate chips, perfect for a sweet break anytime during the day.	{"en": "Bimo Cookies 60g", "fr": "Cookies Bimo 60g", "ar": "\\u0643\\u0648\\u0643\\u064a\\u0632 \\u0628\\u064a\\u0645\\u0648 60\\u063a"}	{"en": "\\"Bimo cookies in a 60g pack, soft biscuits with chocolate chips, perfect for a sweet break anytime during the day.", "fr": "Cookies Bimo en sachet de 60g, biscuits moelleux aux p\\u00e9pites de chocolat, parfaits pour une pause sucr\\u00e9e \\u00e0 tout moment de la journ\\u00e9e.", "ar": "\\u0643\\u0648\\u0643\\u064a\\u0632 \\u0628\\u064a\\u0645\\u0648 \\u0641\\u064a \\u0639\\u0628\\u0648\\u0629 60\\u063a\\u060c \\u0628\\u0633\\u0643\\u0648\\u064a\\u062a \\u0637\\u0631\\u064a \\u0645\\u0639 \\u0642\\u0637\\u0639 \\u0627\\u0644\\u0634\\u0648\\u0643\\u0648\\u0644\\u0627\\u062a\\u0629\\u060c \\u0645\\u062b\\u0627\\u0644\\u064a \\u0644\\u0627\\u0633\\u062a\\u0631\\u0627\\u062d\\u0629 \\u062d\\u0644\\u0648\\u0629 \\u0641\\u064a \\u0623\\u064a \\u0648\\u0642\\u062a \\u0645\\u0646 \\u0627\\u0644\\u064a\\u0648\\u0645."}	58	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/cookies-bimo.png	f	t	14	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	123	2026-02-16 13:38:43.873532	\N	13
Pizza Sauce 4.1kg	Pizza sauce in an economical 4.1kg format, made from selected tomatoes for a smooth texture and authentic flavor, perfect for pizzerias and large preparations.	{"en": "Pizza Sauce 4.1kg", "fr": "Sauce Pizza 4.1kg", "ar": "\\u0635\\u0644\\u0635\\u0629 \\u0628\\u064a\\u062a\\u0632\\u0627 4.1\\u0643\\u063a"}	{"en": "Pizza sauce in an economical 4.1kg format, made from selected tomatoes for a smooth texture and authentic flavor, perfect for pizzerias and large preparations.", "fr": "Sauce pizza en format \\u00e9conomique de 4.1kg, pr\\u00e9par\\u00e9e \\u00e0 partir de tomates s\\u00e9lectionn\\u00e9es pour une texture onctueuse et une saveur authentique, id\\u00e9ale pour les pizzerias et les grandes pr\\u00e9parations.", "ar": "\\u0635\\u0644\\u0635\\u0629 \\u0628\\u064a\\u062a\\u0632\\u0627 \\u0628\\u062d\\u062c\\u0645 \\u0627\\u0642\\u062a\\u0635\\u0627\\u062f\\u064a 4.1\\u0643\\u063a\\u060c \\u0645\\u0635\\u0646\\u0648\\u0639\\u0629 \\u0645\\u0646 \\u0637\\u0645\\u0627\\u0637\\u0645 \\u0645\\u062e\\u062a\\u0627\\u0631\\u0629 \\u0628\\u0642\\u0648\\u0627\\u0645 \\u0646\\u0627\\u0639\\u0645 \\u0648\\u0646\\u0643\\u0647\\u0629 \\u0623\\u0635\\u0644\\u064a\\u0629\\u060c \\u0645\\u062b\\u0627\\u0644\\u064a\\u0629 \\u0644\\u0644\\u0645\\u0637\\u0627\\u0639\\u0645 \\u0648\\u0627\\u0644\\u062a\\u062d\\u0636\\u064a\\u0631\\u0627\\u062a \\u0627\\u0644\\u0643\\u0628\\u064a\\u0631\\u0629"}	480	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/sauce-pizza-4.1kg.png	f	t	17	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	118	2026-02-16 12:45:22.452058	\N	2
Bimo Pesos Biscuits 40g	Bimo Pesos chocolate-flavored biscuits in a 40g individual pack, perfect for a sweet break anytime during the day.	{"en": "Bimo Pesos Biscuits 40g", "fr": "Pesos Bimo 40g", "ar": "\\u0628\\u064a\\u0645\\u0648 \\u0628\\u064a\\u0633\\u0648\\u0633 40\\u063a"}	{"en": "Bimo Pesos chocolate-flavored biscuits in a 40g individual pack, perfect for a sweet break anytime during the day.", "fr": "\\"Biscuits Pesos Bimo au go\\u00fbt chocolat\\u00e9, en sachet individuel de 40g, id\\u00e9als pour une pause gourmande \\u00e0 tout moment de la journ\\u00e9e.", "ar": "\\u0628\\u0633\\u0643\\u0648\\u064a\\u062a \\u0628\\u064a\\u0645\\u0648 \\u0628\\u064a\\u0633\\u0648\\u0633 \\u0628\\u0646\\u0643\\u0647\\u0629 \\u0627\\u0644\\u0634\\u0648\\u0643\\u0648\\u0644\\u0627\\u062a\\u0629 \\u0641\\u064a \\u0639\\u0628\\u0648\\u0629 \\u0641\\u0631\\u062f\\u064a\\u0629 40\\u063a\\u060c \\u0645\\u062b\\u0627\\u0644\\u064a \\u0644\\u0627\\u0633\\u062a\\u0631\\u0627\\u062d\\u0629 \\u0644\\u0630\\u064a\\u0630\\u0629 \\u0641\\u064a \\u0623\\u064a \\u0648\\u0642\\u062a \\u0645\\u0646 \\u0627\\u0644\\u064a\\u0648\\u0645."}	55	PIECE	100	https://elsuq.s3.eu-west-3.amazonaws.com/product-images/pesos-bimo.png	f	t	14	{"type": "range", "min": 10, "max": 100, "step": 10, "pills": [10, 20, 30]}	121	2026-02-16 13:26:08.237155	\N	13
\.


--
-- Data for Name: promotion_usages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.promotion_usages (id, promotion_id, order_id, user_id, discount_applied, created_at) FROM stdin;
\.


--
-- Data for Name: promotions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.promotions (id, name, description, code, name_translations, description_translations, discount_type, discount_value, scope, category_id, brand_id, product_id, min_order_amount, max_discount, usage_limit, usage_count, start_date, end_date, is_active, created_by, created_at, updated_at) FROM stdin;
1	Hiver10	\N	HI10	null	null	FIXED_AMOUNT	10.00	PRODUCT	\N	\N	95	0.00	\N	\N	0	2026-02-16 11:52:26	2026-03-16 11:52:26.306	t	1	2026-02-16 12:53:22.109162	2026-02-16 12:53:33.742088
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (email, full_name, phone, address, role, is_active, id, hashed_password, created_at, updated_at) FROM stdin;
ymekhtoub@gmail.com	Yazid Mekhtoub	3475577129	123 azaghar	CUSTOMER	t	3	$2b$12$FkZRNfCCM51YMagf4YeinOwdQ6N484LobhCAlMpfktiYRevsE.SBu	2026-01-21 16:45:31.925133	2026-01-21 16:46:50.943506
azedinelachab99@icloud.com	Zizou Lachab	347474678	123 rue lycée 	CUSTOMER	t	5	$2b$12$PmMX7SoITgp03uhPCnILduSeXPBG0PBli9RFey31ojOzGIJoPyFfm	2026-01-21 19:40:39.782331	2026-01-21 19:42:01.428724
aissanesnas90@gmail.com	Aissa nesnas	4576748903	123 tafsa boumad	CUSTOMER	t	6	$2b$12$DSf8ifjiVUzDCVX0ZqmxR.WUFozDG6dB54ZEWMgd74XE67s6XlWl2	2026-01-21 22:59:05.040156	2026-01-21 23:06:23.080049
aissanesnas55@gmail.com	Nesnas 	0696497278	Tafsa boumad agouni gueghrane	CUSTOMER	t	7	$2b$12$wT6iM93OCEnObaj8DOUboewrRtjhwPX/VyH9H.lIl/EN/8w0z.eMW	2026-01-22 14:47:34.328302	2026-01-22 14:54:17.020035
hakimhimoun229@gmail.com	hakim himoun	0781091476	ouadhias	CUSTOMER	t	4	$2b$12$M.IeVEypZGHD0w26Wwlm3.q1Gsf6FBo//d.COO4AFhJ4UrJApJU0G	2026-01-21 17:57:50.559449	2026-01-23 20:29:09.541356
test@elsuqhub.com	Test User	\N	\N	CUSTOMER	t	2	$2b$12$gloRLn9jtMYCwyfCmpg54.0SK5d6mDPhBGxaDNeCcRof1CJwaHSbG	2026-01-21 15:57:32.984033	\N
admin@elsuqhub.com	Admin User	\N	\N	ADMIN	t	1	$2b$12$YrEY8m9e6KfqX/hI0IXQAuJ.sTFwSUALDYJURm9wHnfnIdHXThsai	2026-01-21 11:26:06.318132	\N
personnel@elsuqhub.com	Staff User	0000000000	\N	STAFF	t	8	$2b$12$YrEY8m9e6KfqX/hI0IXQAuJ.sTFwSUALDYJURm9wHnfnIdHXThsai	2026-01-30 20:40:32.310262	2026-01-30 20:40:32.310262
yazidchebrine6@gmail.com	Yazid Chebrine	0553648003	125 azeghar	CUSTOMER	t	9	$2b$12$DMeuI4kHJSBUvZmWyiCQsuQtx7oNqgQib9K58DpIvCOs.KHd0zssu	2026-02-08 21:53:28.499582	2026-02-13 13:49:11.372397
brahimouzaoui@gmail.com	Brahim mouzaoui 	3476341835		CUSTOMER	f	10	$2b$12$v32PoaSdyhypcdp5VFYJ/OAQTcYs.Vwl7Tuf0K4xPx4VPXsYKPMKy	2026-02-15 17:08:37.64519	\N
\.


--
-- Name: brands_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.brands_id_seq', 13, true);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.categories_id_seq', 21, true);


--
-- Name: order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.order_items_id_seq', 29, true);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.orders_id_seq', 9, true);


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.products_id_seq', 123, true);


--
-- Name: promotion_usages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.promotion_usages_id_seq', 1, false);


--
-- Name: promotions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.promotions_id_seq', 1, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 10, true);


--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: promotion_usages promotion_usages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usages
    ADD CONSTRAINT promotion_usages_pkey PRIMARY KEY (id);


--
-- Name: promotion_usages promotion_usages_promotion_id_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usages
    ADD CONSTRAINT promotion_usages_promotion_id_order_id_key UNIQUE (promotion_id, order_id);


--
-- Name: promotions promotions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_code_key UNIQUE (code);


--
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: ix_brands_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_brands_name ON public.brands USING btree (name);


--
-- Name: ix_categories_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_categories_name ON public.categories USING btree (name);


--
-- Name: ix_products_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_products_name ON public.products USING btree (name);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: orders orders_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE SET NULL;


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: products products_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id);


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: promotion_usages promotion_usages_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usages
    ADD CONSTRAINT promotion_usages_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: promotion_usages promotion_usages_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usages
    ADD CONSTRAINT promotion_usages_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE CASCADE;


--
-- Name: promotion_usages promotion_usages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_usages
    ADD CONSTRAINT promotion_usages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: promotions promotions_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: promotions promotions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: promotions promotions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: promotions promotions_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict Xa0H9Okm4V5frg39JUO5m7jVKl3hq9vKzVFA9WsxI4nP5SOgAYxPyBq3QuaWfDH


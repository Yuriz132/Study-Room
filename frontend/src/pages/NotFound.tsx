import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { FlyIn } from "@/components/MotionPrimitives";

export function NotFoundFallback() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
      <FlyIn>
        <h1 className="font-bold text-gradient" style={{ fontSize: 'var(--font-size-display)' }}>
          404
        </h1>
        <p className="mt-3 text-muted-foreground" style={{ fontSize: 'var(--font-size-headline)' }}>
          页面不存在
        </p>
        <Link
          to="/"
          className="liquid-glass-accent liquid-glass mt-6 inline-block rounded-full px-6 py-2.5 text-primary"
        >
          返回首页
        </Link>
      </FlyIn>
    </div>
  );
}

const NotFound = () => {
  const location = useLocation();
  useEffect(() => {
    console.error("404 Error:", location.pathname);
  }, [location.pathname]);
  return <NotFoundFallback />;
};

export default NotFound;

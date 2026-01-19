"""
函数执行耗时统计装饰器
"""

import time
import functools
from typing import Callable, TypeVar, Any

# 类型变量，用于泛型函数
F = TypeVar('F', bound=Callable[..., Any])


def timer(func: F) -> F:
    """
    统计函数执行耗时的装饰器
    使用秒单位，保留4位小数，不显示函数参数
    
    使用示例:
        @timer
        def my_function():
            pass
    """
    @functools.wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        start_time = float(time.perf_counter())
        
        try:
            result = func(*args, **kwargs)
            return result
        finally:
            elapsed: float = time.perf_counter() - start_time
            func_name: str = func.__name__
            print(f"[TIMER] {func_name}: {elapsed:.4f} s")
    
    return wrapper  # type: ignore

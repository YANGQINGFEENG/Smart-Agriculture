# Makefile for Smart Agriculture IoT Hardware

# 工具链设置
CC = arm-none-eabi-gcc
AS = arm-none-eabi-as
LD = arm-none-eabi-ld
OBJCOPY = arm-none-eabi-objcopy
OBJDUMP = arm-none-eabi-objdump
SIZE = arm-none-eabi-size

# 目标设备
DEVICE = STM32F103C8T6

# 编译选项
CFLAGS = -mcpu=cortex-m3 -mthumb -std=c99 -Wall -Wextra -O2
CFLAGS += -DSTM32F10X_MD -DUSE_STDPERIPH_DRIVER
CFLAGS += -IApp/Inc
CFLAGS += -IBSP/Inc
CFLAGS += -IMiddlewares/Protocol
CFLAGS += -IMiddlewares/WiFi
CFLAGS += -IConfig

# 链接选项
LDFLAGS = -TSTM32F103C8T6.ld -nostartfiles -Wl,-Map=output.map

# 源文件
SRCS = \
    App/Src/main.c \
    App/Src/system.c \
    BSP/Src/uart.c \
    Middlewares/Protocol/protocol.c \
    Middlewares/Protocol/command_manager.c \
    Middlewares/Protocol/state_manager.c \
    Middlewares/WiFi/wifi_manager.c

# 目标文件
OBJS = $(SRCS:.c=.o)

# 输出文件
TARGET = smart_agriculture.elf
HEX = smart_agriculture.hex
BIN = smart_agriculture.bin

# 目标
all: $(TARGET) $(HEX) $(BIN)
	@echo "\n=== Build completed ==="
	$(SIZE) $(TARGET)

$(TARGET): $(OBJS)
	@echo "\n=== Linking ==="
	$(CC) $(CFLAGS) $(LDFLAGS) -o $@ $(OBJS)

%.o: %.c
	@echo "Compiling $<"
	$(CC) $(CFLAGS) -c -o $@ $<

$(HEX): $(TARGET)
	@echo "\n=== Creating HEX file ==="
	$(OBJCOPY) -O ihex $(TARGET) $(HEX)

$(BIN): $(TARGET)
	@echo "=== Creating BIN file ==="
	$(OBJCOPY) -O binary $(TARGET) $(BIN)

clean:
	@echo "=== Cleaning ==="
	rm -f $(OBJS) $(TARGET) $(HEX) $(BIN) output.map

flash:
	@echo "=== Flashing firmware ==="
	st-flash write $(BIN) 0x8000000

.PHONY: all clean flash

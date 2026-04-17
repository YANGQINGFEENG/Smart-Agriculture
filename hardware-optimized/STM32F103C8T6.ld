/* STM32F103C8T6 Linker Script */

MEMORY
{
  FLASH (rx)      : ORIGIN = 0x08000000, LENGTH = 64K
  RAM (xrw)       : ORIGIN = 0x20000000, LENGTH = 20K
}

SECTIONS
{
  .text :
  {
    KEEP(*(.isr_vector))
    *(.text)
    *(.text.*)
    *(.rodata)
    *(.rodata.*)
    *(.glue_7)
    *(.glue_7t)
    *(.eh_frame)
  } > FLASH

  .data :
  {
    *(.data)
    *(.data.*)
  } > RAM AT > FLASH
  _sidata = LOADADDR(.data);

  .bss :
  {
    *(.bss)
    *(.bss.*)
    *(COMMON)
  } > RAM

  _end = .;
  PROVIDE (end = .);
}
